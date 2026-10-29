#!/usr/bin/env python3
"""Reproducible public directory and provenance; Python standard library only."""
import argparse
import csv
import hashlib
import io
import json
import os
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
BASE = "https://production.oknesset.org/pipelines/data/"
PATHS = {
    "people": "members/mk_individual/mk_individual.csv",
    "roles": "members/kns_persontoposition/kns_persontoposition.csv",
    "positions": "members/kns_position/kns_position.csv",
    "ministries": "knesset/kns_govministry/kns_govministry.csv",
    "attendance": "people/committees/committee-meeting-attendees-mks-stats/mk_attendance.csv",
}
MK = {"43", "61"}
GOVERNMENT = {"39", "57", "40", "59", "285079", "45", "50", "65", "51", "73", "31"}
MINISTERS = {"39", "57", "45"}
COMMITTEES = {"41", "42", "66", "67"}


def truth(value):
    return str(value).lower() in ("true", "1")


def day(value):
    return str(value or "")[:10]


def active(role, today):
    """IsCurrent alone is insufficient: reject future and expired assignments."""
    return (truth(role.get("IsCurrent"))
            and (not role.get("StartDate") or day(role["StartDate"]) <= today)
            and (not role.get("FinishDate") or day(role["FinishDate"]) >= today))


def fetch(key, cache):
    """Conditional HTTP cache outside checkout; validate before using each response."""
    url = BASE + PATHS[key]
    cache.mkdir(parents=True, exist_ok=True)
    file = cache / (key + ".csv")
    meta_file = cache / (key + ".meta.json")
    meta = json.loads(meta_file.read_text()) if meta_file.exists() else {}
    headers = {"User-Agent": "IsraelFractal-PublicDirectory/1.0"}
    if file.exists() and meta.get("last_modified"):
        headers["If-Modified-Since"] = meta["last_modified"]
    try:
        with urlopen(Request(url, headers=headers), timeout=90) as response:
            limit = 160_000_000 if key == "attendance" else 20_000_000
            temp = file.with_suffix(".tmp")
            total = 0
            digest = hashlib.sha256()
            try:
                with temp.open("wb") as out:
                    while block := response.read(1024 * 1024):
                        total += len(block)
                        if total > limit:
                            raise ValueError(f"{key}: response exceeds safety limit")
                        digest.update(block)
                        out.write(block)
                with temp.open(encoding="utf-8-sig", newline="") as check:
                    header = next(csv.reader(check), [])
                required = {
                    "people": "PersonID", "roles": "PersonToPositionID",
                    "positions": "PositionID", "ministries": "GovMinistryID",
                    "attendance": "meeting_start_date",
                }[key]
                if required not in header:
                    raise ValueError(f"{key}: invalid CSV schema (possibly an HTML error page)")
                meta = {"url": url, "last_modified": response.headers.get("Last-Modified"),
                        "sha256": digest.hexdigest(), "bytes": total}
                temp.replace(file)
                meta_file.write_text(json.dumps(meta), encoding="utf-8")
            finally:
                temp.unlink(missing_ok=True)
    except HTTPError as error:
        if error.code != 304 or not file.exists():
            raise
    return file, meta


def rows(path):
    with path.open(encoding="utf-8-sig", newline="") as handle:
        yield from csv.DictReader(handle)


def make_directory(people, roles, positions, ministries, today):
    people_by_id = {r["PersonID"]: r for r in people}
    labels = {r["PositionID"]: r["Description"] for r in positions}
    current = [r for r in roles if active(r, today)]
    knesset = max(int(r["KnessetNum"]) for r in current if r["PositionID"] in MK)
    government = max(int(r["GovernmentNum"]) for r in current
                     if r["PositionID"] in GOVERNMENT and r.get("GovernmentNum"))
    current = [r for r in current if
               (r["PositionID"] in GOVERNMENT and r.get("GovernmentNum") == str(government))
               or (r["PositionID"] not in GOVERNMENT and r.get("KnessetNum") == str(knesset))]
    selected = {r["PersonID"] for r in current if r["PositionID"] in MK | GOVERNMENT}
    unknown = selected - people_by_id.keys()
    if unknown:
        raise ValueError(f"{len(unknown)} role holders have no person record")
    grouped = defaultdict(list)
    all_roles = defaultdict(list)
    for r in current:
        grouped[r["PersonID"]].append(r)
    for r in roles:
        if r["PositionID"] in MK | GOVERNMENT:
            all_roles[r["PersonID"]].append(r)

    def role_record(r):
        return {"id": r["PersonToPositionID"], "position_id": r["PositionID"],
                "title": labels.get(r["PositionID"], "תפקיד ללא תיאור"),
                "organization": r.get("GovMinistryName") or r.get("CommitteeName") or "",
                "ministry_id": r.get("GovMinistryID") or None,
                "start": day(r.get("StartDate")), "end": day(r.get("FinishDate")),
                "updated_at": r.get("LastUpdatedDate")}

    result = []
    for pid in selected:
        p = people_by_id[pid]
        assignments = grouped[pid]
        relevant = [r for r in assignments if r["PositionID"] in MK | GOVERNMENT]
        mk_role = next((r for r in assignments if r["PositionID"] in MK), None)
        faction = next((r.get("FactionName") for r in assignments
                        if r["PositionID"] == "54" and r.get("FactionName")), None)
        comms = sorted({r["CommitteeName"] for r in assignments
                        if r["PositionID"] in COMMITTEES and r.get("CommitteeName")})
        history = sorted(all_roles[pid], key=lambda r: r.get("StartDate", ""), reverse=True)
        result.append({
            "id": pid, "name": f'{p["FirstName"]} {p["LastName"]}',
            "is_mk": mk_role is not None,
            "is_minister": any(r["PositionID"] in MINISTERS for r in relevant),
            "is_government": any(r["PositionID"] in GOVERNMENT for r in relevant),
            "faction": faction, "roles": [role_record(r) for r in relevant],
            "committees": comms, "role_history": [role_record(r) for r in history[:12]],
            "mk_start": day(mk_role.get("StartDate")) if mk_role else None,
            "source_url": f"https://oknesset.org/members/{pid}.html",
            "source_row_updated_at": max((r.get("LastUpdatedDate", "") for r in relevant), default=""),
            "metrics": {"current_attendance": None, "vote_participation": None,
                        "service_results": None, "composite_score": None},
        })
    result.sort(key=lambda p: p["name"])
    office_list = []
    for m in ministries:
        if truth(m["IsActive"]) and m.get("GovID") == str(government):
            office_list.append({
                "id": m["GovMinistryID"], "name": m["Name"],
                "government": government, "source_row_updated_at": m["LastUpdatedDate"],
                "official_ids": [p["id"] for p in result
                                 if any(r["ministry_id"] == m["GovMinistryID"] for r in p["roles"])],
                "director_general": None, "metrics": {"budget_execution": None,
                    "service_time": None, "target_delivery": None},
            })
    office_list.sort(key=lambda m: m["name"])
    mk_count = sum(p["is_mk"] for p in result)
    if not 100 <= mk_count <= 120:
        raise ValueError(f"Unexpected MK roster size: {mk_count}; preserve last valid snapshot")
    if len(office_list) < 10:
        raise ValueError("Unexpected ministry roster size; preserve last valid snapshot")
    return result, office_list, knesset, government


def committee_metrics(path, people, knesset, today):
    """Count documented appearances, never infer absence or attendance percentage."""
    latest = ""
    wanted = {p["id"] for p in people}
    for r in rows(path):
        d = day(r.get("meeting_start_date"))
        if r.get("knesset_num") == str(knesset) and d <= today:
            latest = max(latest, d)
    if not latest:
        return {"status": "missing", "latest_event_at": None}
    end = date.fromisoformat(latest)
    start = end - timedelta(days=29)
    seen = defaultdict(set)
    for r in rows(path):
        d = day(r.get("meeting_start_date"))
        if (r.get("knesset_num") == str(knesset) and start.isoformat() <= d <= latest
                and r.get("mk_id") in wanted):
            seen[r["mk_id"]].add((r["committee_id"], r["meeting_start_date"]))
    stale = (date.fromisoformat(today) - end).days > 7
    for p in people:
        # Do not assign historical activity to people appointed after the data window.
        eligible = p["is_mk"] and p.get("mk_start") and p["mk_start"] <= latest
        value = len(seen[p["id"]]) if eligible else None
        p["metrics"]["documented_committee_meetings"] = {
            "value": value, "start": start.isoformat(), "end": latest,
            "status": "historical" if stale else "recent_documented",
            "is_attendance_rate": False,
        }
    return {"status": "historical" if stale else "recent_documented",
            "start": start.isoformat(), "end": latest, "latest_event_at": latest}


def history_entry(snapshot):
    return {"date": snapshot["fetched_at"][:10], "fetched_at": snapshot["fetched_at"],
            "source_activity_end": snapshot["activity"].get("latest_event_at"),
            "mk_count": sum(p["is_mk"] for p in snapshot["people"]),
            "ministry_count": len(snapshot["ministries"]),
            "people": {p["id"]: {"role_ids": sorted(r["id"] for r in p["roles"]),
                                "documented_meetings": p["metrics"].get(
                                    "documented_committee_meetings", {}).get("value")}
                       for p in snapshot["people"]}}


def atomic_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix(".tmp")
    temp.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temp.replace(path)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--cache-dir", type=Path,
                        default=Path(os.environ.get("PUBLIC_DATA_CACHE", "/tmp/israel-fractal-public-cache")))
    parser.add_argument("--output-dir", type=Path, default=ROOT / "data")
    args = parser.parse_args()
    csv.field_size_limit(2_000_000)
    files, sources = {}, {}
    for key in PATHS:
        files[key], sources[key] = fetch(key, args.cache_dir)
        print(f"Validated source: {key}")
    now = datetime.now(timezone.utc)
    today = now.date().isoformat()
    people, ministries, knesset, government = make_directory(
        list(rows(files["people"])), list(rows(files["roles"])),
        list(rows(files["positions"])), list(rows(files["ministries"])), today)
    activity = committee_metrics(files["attendance"], people, knesset, today)
    snapshot = {"schema_version": 1, "fetched_at": now.isoformat(),
                "knesset": knesset, "government": government, "sources": sources,
                "roster_status": "secondary_source_not_independently_verified",
                "activity": activity, "people": people, "ministries": ministries,
                "coverage": {"directors_general": "not_connected",
                             "public_agency_heads": "not_connected",
                             "current_votes": "not_available_in_connected_source",
                             "current_attendance": "not_available_in_connected_source",
                             "ministry_outcomes": "not_connected"}}
    history_path = args.output_dir / "history.json"
    previous = json.loads(history_path.read_text()) if history_path.exists() else []
    # Exactly one sample per UTC day, retained for 90 days. This is collection history,
    # not evidence that activity happened on the collection date.
    history = [h for h in previous if h["date"] != today]
    history.append(history_entry(snapshot))
    history = sorted(history, key=lambda h: h["date"])[-90:]
    atomic_json(args.output_dir / "national.json", snapshot)
    atomic_json(history_path, history)
    print(f"Saved {len(people)} people, {len(ministries)} ministries; activity ends {activity.get('end')}")


if __name__ == "__main__":
    main()
