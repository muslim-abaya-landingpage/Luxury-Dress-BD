import { execSync } from "child_process";
import fs from "fs";
const html = execSync("git show HEAD:index.html", {
  cwd: "d:/Luxury-Dress-BD",
  encoding: "utf8",
  maxBuffer: 10 * 1024 * 1024,
});
fs.writeFileSync("d:/Luxury-Dress-BD/_head-index-backup.html", html, "utf8");
const lines = html.split("\n");
console.log("lines", lines.length);
console.log(lines.slice(-60).join("\n"));
