import fs from "fs";
import p from "../package.json" assert { type: "json" };

fs.writeFileSync(
  "./src/README.txt",
  fs
    .readFileSync("./src/README.txt", "utf8")
    .replace(/\{\{VERSION\}\}/g, p.version)
);

console.log("Successfuly replaced");
