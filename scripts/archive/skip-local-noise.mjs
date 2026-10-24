import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const patterns = [
  /^ADMIN-.*\.bat$/i,
  /^API-.*\.bat$/i,
  /^APPS-SCRIPT-.*\.md$/i,
  /^দৈনিক-চেকলিস্ট\.md$/,
  /^প্রথম-সপ্তাহ-চেকলিস্ট\.md$/,
];

const files = fs.readdirSync(root).filter(function (name) {
  return patterns.some(function (re) {
    return re.test(name);
  });
});

files.forEach(function (name) {
  execSync(`git update-index --skip-worktree -- "${name.replace(/"/g, '\\"')}"`, {
    cwd: root,
    stdio: "inherit",
  });
  console.log("skip-worktree:", name);
});

console.log("Done. git add will ignore local edits on these files.");
