import fs from "fs";
import p from "../package.json" assert { type: "json" };

fs.writeFileSync(
  "./README.txt",
  fs.readFileSync("./README.txt", "utf8").replace(/\{\{VERSION\}\}/g, p.version)
);

console.log("Successfuly replaced");
