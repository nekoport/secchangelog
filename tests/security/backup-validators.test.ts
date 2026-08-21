import test from "node:test";
import assert from "node:assert/strict";
import { hasSqliteHeader, validateBackupMemberName, validateArchiveEntries } from "../../src/lib/security/backup-validation.ts";

test("backup member validator rejects unsafe paths", () => {
    assert.equal(validateBackupMemberName("secchangelog.db"), true);
    assert.equal(validateBackupMemberName("uploads/screenshots/a.png"), true);
    assert.equal(validateBackupMemberName("/secchangelog.db"), false);
    assert.equal(validateBackupMemberName("uploads/../secchangelog.db"), false);
    assert.equal(validateBackupMemberName("uploads\\screenshots\\a.png"), false);
    assert.equal(validateBackupMemberName("uploads//a.png"), false);
    assert.equal(validateBackupMemberName("uploads/"), true);
});

test("checks SQLite header and tar limits/types", () => {
    assert.equal(hasSqliteHeader(Buffer.from("SQLite format 3\0data")), true);
    assert.equal(hasSqliteHeader(Buffer.from("not a database")), false);
    assert.throws(() => validateArchiveEntries(["secchangelog.db"], ["lrwxrwxrwx 1 x x 20 Jan 1 00:00 secchangelog.db"]));
    assert.throws(() => validateArchiveEntries(["evil.txt"], ["-rw-r--r-- 1 x x 4 Jan 1 00:00 evil.txt"]));
    assert.doesNotThrow(() => validateArchiveEntries(["secchangelog.db", "uploads/"], ["-rw-r--r-- user/group 100 Jan 1 00:00 secchangelog.db", "drwxr-xr-x user/group 0 Jan 1 00:00 uploads/"]));
    assert.doesNotThrow(() => validateArchiveEntries(["secchangelog.db"], ["-rw-r--r-- 999 100 100 Jan 1 00:00 secchangelog.db"]));
    assert.throws(() => validateArchiveEntries(["secchangelog.db"], ["-rw-r--r-- user/group 536870913 Jan 1 00:00 secchangelog.db"]));
    assert.throws(() => validateArchiveEntries(["secchangelog.db"], []));
});
