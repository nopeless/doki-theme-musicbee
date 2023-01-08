import {
  BaseAppDokiThemeDefinition,
  constructNamedColorTemplate,
  DokiThemeDefinitions,
  evaluateTemplates,
  fillInTemplateScript,
  MasterDokiThemeDefinition,
  resolvePaths,
  StringDictionary,
} from "doki-build-source";
import omit from "lodash/omit";
import fs from "fs";
import path from "path";
import { hexToRGBA, isValidHex } from "./hextorgba";

type AppDokiThemeDefinition = BaseAppDokiThemeDefinition;

const { repoDirectory, masterThemeDefinitionDirectoryPath } =
  resolvePaths(__dirname);

type MusicBeeVariables = Record<string, any>;

function buildTemplateVariables(
  dokiThemeDefinition: MasterDokiThemeDefinition,
  masterTemplateDefinitions: DokiThemeDefinitions,
  dokiThemeAppDefinition: AppDokiThemeDefinition
): MusicBeeVariables {
  const namedColors: StringDictionary<string> = constructNamedColorTemplate(
    dokiThemeDefinition,
    masterTemplateDefinitions
  );
  const colorsOverride = dokiThemeAppDefinition.overrides.theme?.colors || {};
  const cleanedColors = Object.entries(namedColors).reduce(
    (accum, [colorName, colorValue]) => ({
      ...accum,
      [colorName]: colorValue,
    }),
    {}
  );
  const o = {
    ...dokiThemeDefinition,
    ...masterTemplateDefinitions,
    ...cleanedColors,
    ...colorsOverride,
  };

  delete (o as any)["colors"];

  /**
   * Transforms everything
   */
  function recapp(o: object, f: (x: unknown) => any) {
    Object.entries(o).forEach(([i, v]) => {
      if (typeof v === "object") {
        if (v !== null) {
          recapp(v, f);
        }
      } else {
        // @ts-ignore
        o[i] = f(v);
      }
    });
  }

  recapp(o, (v) => {
    if (typeof v === "string") {
      if (isValidHex(v)) {
        const [r, g, b, a] = hexToRGBA(v);
        if (a === 255 || a === undefined) {
          return [r, g, b].toString();
        }
        // MusicBee uses ARGB scheme
        return [a, r, g, b].toString();
      }
    }
    return v;
  });

  return o;
}

function createDokiTheme(
  masterThemeDefinitionPath: string,
  masterThemeDefinition: MasterDokiThemeDefinition,
  appTemplateDefinitions: DokiThemeDefinitions,
  appThemeDefinition: AppDokiThemeDefinition,
  masterTemplateDefinitions: DokiThemeDefinitions
) {
  try {
    return {
      path: masterThemeDefinitionPath,
      definition: masterThemeDefinition,
      stickers: getStickers(masterThemeDefinition, masterThemeDefinitionPath),
      templateVariables: buildTemplateVariables(
        masterThemeDefinition,
        masterTemplateDefinitions,
        appThemeDefinition
      ),
      theme: {},
      appThemeDefinition: appThemeDefinition,
    };
  } catch (e) {
    if (typeof e === "object" && e !== null) {
      (
        e as Record<string, unknown>
      ).message = `Unable to build ${masterThemeDefinition.name}'s theme for reasons ${e}`;
    }

    throw e;
  }
}

function resolveStickerPath(themeDefinitionPath: string, sticker: string) {
  console.log("Sticker", sticker);
  const stickerPath = path.resolve(
    path.resolve(themeDefinitionPath, ".."),
    sticker
  );
  return stickerPath.substr(
    masterThemeDefinitionDirectoryPath.length + "/definitions".length
  );
}

const getStickers = (
  dokiDefinition: MasterDokiThemeDefinition,
  themePath: string
) => {
  const secondary =
    dokiDefinition.stickers.secondary || dokiDefinition.stickers.normal;
  return {
    default: {
      path: resolveStickerPath(
        themePath,
        // FIXME
        // Force fix
        // Read https://github.com/doki-theme/doki-theme-template/issues/2
        (dokiDefinition.stickers.default as unknown as { name: string }).name
      ),
      name: (dokiDefinition.stickers.default as unknown as { name: string })
        .name,
    },
    ...(secondary
      ? {
          secondary: {
            path: resolveStickerPath(
              themePath,
              (secondary as unknown as { name: string }).name
            ),
            name: (secondary as unknown as { name: string }).name,
          },
        }
      : {}),
  };
};

console.log("Preparing to generate themes.");
const themesDirectory = path.resolve(repoDirectory, "out", "musicbee-skins");

// Ensure directories exist
{
  const e = (...p: string[]) => {
    if (!fs.existsSync(path.resolve(repoDirectory, ...p))) {
      fs.mkdirSync(path.resolve(repoDirectory, ...p));
    }
  };

  e("out");
  e("out", themesDirectory);
}

const templateString = fs.readFileSync(
  path.resolve(
    repoDirectory,
    "buildSrc",
    "assets",
    "templates",
    "doki-theme.skin.template.xml"
  ),
  "utf8"
);

evaluateTemplates(
  {
    appName: "musicbee",
    currentWorkingDirectory: __dirname,
  },
  (
    dokiFileDefinitionPath,
    dokiThemeDefinition,
    _,
    dokiThemeAppDefinition,
    appTemplateDefinitions
  ) => {
    return createDokiTheme(
      dokiFileDefinitionPath,
      dokiThemeDefinition,
      appTemplateDefinitions,
      dokiThemeAppDefinition,
      appTemplateDefinitions
    );
  }
)
  .then((dokiThemes) => {
    // write things for extension
    const dokiThemeDefinitions = dokiThemes
      .map((dokiTheme) => {
        const dokiDefinition = dokiTheme.definition;
        return {
          information: omit(dokiDefinition, [
            "colors",
            "overrides",
            "ui",
            "icons",
          ]),
          colors: dokiTheme.appThemeDefinition.colors,
          stickers: dokiTheme.stickers,
        };
      })
      .reduce((accum: StringDictionary<any>, definition) => {
        accum[definition.information.id ?? 0] = definition;
        return accum;
      }, {});

    // This file is not needed
    // const finalDokiDefinitions = JSON.stringify(dokiThemeDefinitions);

    // fs.writeFileSync(
    //   path.resolve(repoDirectory, "src", "DokiThemeDefinitions.ts"),
    //   `export default ${finalDokiDefinitions};`
    // );

    return dokiThemes;
  })
  // More dead code
  // .then((themes) => {
  //   // write things for extension
  //   for (const theme of themes) {
  //     const filename =
  //       theme.definition.name.toLowerCase().replace(/[<>:"/\\|?*]/g, "") +
  //       ".xml";
  //     // write the files
  //     fs.writeFileSync(
  //       path.resolve(themesDirectory, filename),
  //       fillInTemplateScript(templateString, theme.templateVariables)
  //     );
  //   }
  // })
  .then(() => {
    console.log("Theme Generation Complete!");
  });
