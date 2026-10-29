import csv
import importlib.util
import io
import json
import tempfile
import unittest
from unittest.mock import patch
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("sync", ROOT / "scripts/sync_public_data.py")
sync = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sync)


def fixture():
    people = [{"PersonID": str(i), "FirstName": "שם", "LastName": str(i),
               "mk_individual_id": str(i)} for i in range(100)]
    roles = [{"PersonToPositionID": str(i), "PersonID": str(i), "PositionID": "43",
              "KnessetNum": "25", "GovernmentNum": "", "GovMinistryID": "",
              "IsCurrent": "True", "StartDate": "2022-11-15", "FinishDate": "",
              "LastUpdatedDate": "2025-01-01"} for i in range(100)]
    roles.append({"PersonToPositionID": "gov", "PersonID": "0", "PositionID": "39",
                  "KnessetNum": "25", "GovernmentNum": "37", "GovMinistryID": "1",
                  "IsCurrent": "True", "StartDate": "2022-12-29", "FinishDate": "",
                  "LastUpdatedDate": "2025-01-01"})
    positions = [{"PositionID": "43", "Description": "חבר הכנסת"},
                 {"PositionID": "39", "Description": "שר"},
                 {"PositionID": "42", "Description": "חבר ועדה"}]
    ministries = [{"GovMinistryID": str(i), "Name": f"משרד {i}", "GovID": "37",
                   "IsActive": "True", "LastUpdatedDate": "2025-01-01"} for i in range(10)]
    return people, roles, positions, ministries


class DirectoryTests(unittest.TestCase):
    def test_html_error_response_cannot_replace_valid_cached_csv(self):
        with tempfile.TemporaryDirectory() as directory:
            cache = Path(directory)
            original = "PersonToPositionID\nold-record\n"
            (cache / "roles.csv").write_text(original)
            (cache / "roles.meta.json").write_text('{"last_modified": "yesterday"}')
            response = io.BytesIO(b"<html>The site is unavailable</html>")
            response.headers = {"Last-Modified": "today"}
            with patch.object(sync, "urlopen", return_value=response):
                with self.assertRaises(ValueError):
                    sync.fetch("roles", cache)
            self.assertEqual((cache / "roles.csv").read_text(), original)
            self.assertFalse((cache / "roles.tmp").exists())

    def test_future_and_expired_roles_are_not_current(self):
        role = {"IsCurrent": "True", "StartDate": "2026-10-01", "FinishDate": ""}
        self.assertTrue(sync.active(role, "2026-10-29"))
        self.assertFalse(sync.active({**role, "StartDate": "2027-01-01"}, "2026-10-29"))
        self.assertFalse(sync.active({**role, "FinishDate": "2026-10-02"}, "2026-10-29"))
        self.assertFalse(sync.active({**role, "IsCurrent": "False"}, "2026-10-29"))

    def test_roster_uses_mk_roles_not_person_iscurrent(self):
        people, roles, positions, ministries = fixture()
        people.append({"PersonID": "secretary", "FirstName": "לא", "LastName": "ח״כ",
                       "IsCurrent": "True", "mk_individual_id": "999"})
        roles.append({**roles[0], "PersonToPositionID": "old", "PositionID": "42",
                      "KnessetNum": "19", "CommitteeName": "ועדה ישנה"})
        people, offices, knesset, government = sync.make_directory(
            people, roles, positions, ministries, "2026-10-29")
        self.assertEqual(len(people), 100)
        self.assertEqual((knesset, government), (25, 37))
        self.assertEqual(people[0]["committees"], [])
        self.assertTrue(all(p["metrics"]["composite_score"] is None for p in people))
        office = next(m for m in offices if m["id"] == "1")
        self.assertEqual(office["official_ids"], ["0"])

    def test_incomplete_roster_fails_instead_of_publishing(self):
        people, roles, positions, ministries = fixture()
        with self.assertRaises(ValueError):
            sync.make_directory(people, roles[:50] + [roles[-1]], positions,
                                ministries, "2026-10-29")

    def test_unknown_person_fails_instead_of_dropping_the_record(self):
        people, roles, positions, ministries = fixture()
        with self.assertRaises(ValueError):
            sync.make_directory(people[1:], roles, positions, ministries, "2026-10-29")

    def test_documented_meetings_deduplicate_and_remain_historical(self):
        people = [{"id": "1", "is_mk": True, "mk_start": "2022-11-15", "metrics": {}},
                  {"id": "2", "is_mk": True, "mk_start": "2026-01-01", "metrics": {}}]
        fields = ["knesset_num", "committee_id", "meeting_start_date", "mk_id"]
        with tempfile.TemporaryDirectory() as d:
            path = Path(d) / "attendance.csv"
            with path.open("w", newline="") as f:
                writer = csv.DictWriter(f, fieldnames=fields)
                writer.writeheader()
                row = dict(zip(fields, ["25", "5", "2025-08-11 09:00:00", "1"]))
                writer.writerows([row, row, {**row, "committee_id": "6"},
                                  {**row, "meeting_start_date": "2027-01-01 09:00:00"}])
            coverage = sync.committee_metrics(path, people, 25, "2026-10-29")
        self.assertEqual(coverage["latest_event_at"], "2025-08-11")
        self.assertEqual(coverage["status"], "historical")
        self.assertEqual(people[0]["metrics"]["documented_committee_meetings"]["value"], 2)
        self.assertIsNone(people[1]["metrics"]["documented_committee_meetings"]["value"])

    def test_snapshot_schema_and_no_private_contact_data(self):
        path = ROOT / "data/national.json"
        if not path.exists():
            self.skipTest("Snapshot has not been generated yet")
        data = json.loads(path.read_text())
        self.assertEqual(data["schema_version"], 1)
        self.assertEqual(len({p["id"] for p in data["people"]}), len(data["people"]))
        self.assertGreaterEqual(sum(p["is_mk"] for p in data["people"]), 100)
        for person in data["people"]:
            self.assertNotIn("Email", person)
            self.assertNotIn("GenderDesc", person)
            self.assertIsNone(person["metrics"]["composite_score"])
            self.assertTrue(person["source_url"].startswith("https://oknesset.org/members/"))
        for source in data["sources"].values():
            self.assertEqual(len(source["sha256"]), 64)
        self.assertTrue(all(m["director_general"] is None for m in data["ministries"]))


if __name__ == "__main__":
    unittest.main()
