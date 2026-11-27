"""Build the CSO ED and LEA vector tileset for the map.

Downloads the CSO 2022 Electoral Division and Local Electoral Area boundaries
from Geohive, joins the CSO residential property purchaser figures to the
LEAs, and writes one PMTiles file with two layers.

Run with `uv run build_tiles.py`. Downloads are cached in `raw/`: delete that
directory to fetch new data.
"""

import json
import urllib.parse
import urllib.request
from pathlib import Path

import geopandas as gpd
import manby
import pandas as pd

HERE = Path(__file__).parent
RAW = HERE / "raw"
OUTPUT = HERE.parent / "static" / "cso_2022.pmtiles"

SERVICES = "https://services-eu1.arcgis.com/BuS9rtTsYEV5C0xh/arcgis/rest/services"
ED_URL = f"{SERVICES}/CSO_Electoral_Divisions_National_Statistical_Boundaries_2022_Ungeneralised_view/FeatureServer/1"
LEA_URL = f"{SERVICES}/CSO_Local_Electoral_Areas_National_Statistical_Boundaries_2022_Ungeneralised_view/FeatureServer/3"
# The services allow 2000 records a page, but large pages of ungeneralised
# polygons stall.
PAGE_SIZE = 250
# Six decimal places of a degree are approximately 0.1 m.
GEOMETRY_PRECISION = 6

# CRP15 is keyed on LEA GUIDs, which match LEA_GUID in the 2022 boundaries.
CSO_TABLE = "CRP15"
CSO_YEAR = "2024"
# PxStat dimension code of the "CSO Local Electoral Areas 2022" column.
CSO_LEA_CODE = "C04166V04937"
CSO_URL = f"https://ws.cso.ie/public/api.restful/PxStat.Data.Cube_API.ReadDataset/{CSO_TABLE}/CSV/1.0/en"

ED_FIELDS = ["OBJECTID", "ED_ID_STR", "ED_ENGLISH", "COUNTY_ENGLISH"]
LEA_FIELDS = ["OBJECTID", "LEA_GUID", "LEA_ID", "CSO_LEA", "COUNTY"]

# Irish Transverse Mercator: metres, for simplification.
ITM = 2157
SIMPLIFY_TOLERANCE_M = 1.0


def fetch(url: str) -> bytes:
    with urllib.request.urlopen(url, timeout=120) as response:
        return response.read()


def fetch_layer(url: str, fields: list[str], cache: Path) -> gpd.GeoDataFrame:
    """Download all features of a FeatureServer layer as GeoJSON, page by page."""
    if not cache.exists():
        features = []
        offset = 0
        while True:
            params = urllib.parse.urlencode(
                {
                    "where": "1=1",
                    "outFields": ",".join(fields),
                    "orderByFields": "OBJECTID",
                    "resultOffset": offset,
                    "resultRecordCount": PAGE_SIZE,
                    "geometryPrecision": GEOMETRY_PRECISION,
                    "f": "geojson",
                }
            )
            page = json.loads(fetch(f"{url}/query?{params}"))
            features.extend(page["features"])
            print(f"{cache.name}: {len(features)} features")
            if not page.get("properties", {}).get("exceededTransferLimit"):
                break
            offset += PAGE_SIZE
        cache.write_text(
            json.dumps({"type": "FeatureCollection", "features": features})
        )
    gdf = gpd.read_file(cache)
    return gdf[[*fields, "geometry"]]


def fetch_cso_figures(cache: Path) -> pd.DataFrame:
    """Get median income and median price per LEA GUID for CSO_YEAR."""
    if not cache.exists():
        cache.write_bytes(fetch(CSO_URL))
    df = pd.read_csv(cache, encoding="utf-8-sig", dtype=str)
    df = df[
        (df["Year"] == CSO_YEAR)
        & (df["Stamp Duty Event"] == "Filings")
        & (df["Transaction Type"] == "All Transactions")
        & (df["Type of Buyer"] == "All buyer types")
        & (df[CSO_LEA_CODE] != "-")
    ]
    figures = df.pivot(index=CSO_LEA_CODE, columns="Statistic Label", values="VALUE")
    figures = figures[["Median Income", "Median Price"]].apply(pd.to_numeric)
    figures.columns = ["MEDIAN_INCOME", "MEDIAN_PRICE"]
    figures["FIGURES_YEAR"] = CSO_YEAR
    figures.index.name = "LEA_GUID"
    return figures.reset_index()


def simplify(gdf: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    gdf = gdf.to_crs(ITM)
    # Some source rings intersect themselves. Repair them before coverage
    # simplification, which needs valid polygons.
    gdf["geometry"] = gdf.make_valid(method="structure", keep_collapsed=False)
    gdf["geometry"] = gdf.geometry.simplify_coverage(SIMPLIFY_TOLERANCE_M)
    return gdf.to_crs(4326)


def main() -> None:
    RAW.mkdir(exist_ok=True)
    eds = fetch_layer(ED_URL, ED_FIELDS, RAW / "eds.geojson")
    leas = fetch_layer(LEA_URL, LEA_FIELDS, RAW / "leas.geojson")
    figures = fetch_cso_figures(RAW / f"{CSO_TABLE}.csv")

    leas = gpd.GeoDataFrame(
        leas.merge(figures, on="LEA_GUID", how="left", validate="one_to_one")
    )
    missing = leas[leas["MEDIAN_INCOME"].isna() | leas["MEDIAN_PRICE"].isna()]
    if not missing.empty:
        raise SystemExit(
            f"No {CSO_TABLE} figures for LEAs: {missing['CSO_LEA'].tolist()}"
        )
    leas = gpd.GeoDataFrame(leas.drop(columns="LEA_GUID"))

    manby.tile(
        {"cso-ed-polygons": simplify(eds), "cso-lea-polygons": simplify(leas)},
        OUTPUT,
        minimum_zoom=3,
        maximum_zoom=12,
        detect_shared_borders=True,
    )
    print(f"Wrote {OUTPUT} ({OUTPUT.stat().st_size / 1e6:.1f} MB)")


if __name__ == "__main__":
    main()
