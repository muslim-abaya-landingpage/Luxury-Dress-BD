import fs from "fs";
let css = fs.readFileSync("index-home.css", "utf8");
const badStart = css.indexOf("    /* Footer styles: site-footer.css");
if (badStart !== -1) {
  const styleTag = css.indexOf("<style>", badStart);
  if (styleTag !== -1) {
    css = css.slice(0, badStart) + css.slice(styleTag + "<style>".length);
  } else {
    css = css.slice(0, badStart);
  }
}
css = css.replace(/<\/?style>/g, "");
css = css.replace(/<div[^>]*>[\s\S]*?<\/script>/g, "");
fs.writeFileSync("index-home.css", css.trim() + "\n", "utf8");
console.log("fixed", fs.statSync("index-home.css").size);
