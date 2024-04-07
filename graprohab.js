/**
 * App functions
 */

require("dotenv").config();

const env = process.env.NODE_ENV || "development";
const config = require(__dirname + "/config/config.json")[env];

const puppeteer = require("puppeteer");

const queryProperty = async (reference) => {
  const browser = await puppeteer.launch({
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();

  const BASE_URL =
    "https://www.habitacao.sp.gov.br/graprohab/PesquisaProtocoloGraprohab.aspx";

  const FORM_ELEMENTS_IDS = {
    referenceInput: "#ContentPlaceHolder1_txtNrProtocolo",
    searchButton: "#ContentPlaceHolder1_lkbPesquisar",
  };

  await page.goto(BASE_URL);
  await page.type(FORM_ELEMENTS_IDS.referenceInput, reference);
  await page.click(FORM_ELEMENTS_IDS.searchButton);

  const selector = "#ContentPlaceHolder1_lblNmEmpreendimento";

  await page.waitForSelector(selector);

  const result = await page.evaluate((selector) => {
    const RESULT_ATTRS_ELEMENTS = {
      Número: "#ContentPlaceHolder1_lblNrProtocolo",
      Interessado: "#ContentPlaceHolder1_lblInteressado",
      Empreendimento: "#ContentPlaceHolder1_lblNmEmpreendimento",
      Município: "#ContentPlaceHolder1_lblNmLocalidade",
      "Data Entrada": "#ContentPlaceHolder1_lblDataEntrada",
      "Data da Última Reunião Prevista": "#ContentPlaceHolder1_lblDataReuniao",
      "Assunto da Reunião": "#ContentPlaceHolder1_lblNmAssuntoReuniao",
      Certificado: "#ContentPlaceHolder1_lblNmSituacao",
      Situação: "#ContentPlaceHolder1_lblNmSituacao",
      "Tipo Empreendimento": "#ContentPlaceHolder1_lblTipoEmpreendimento",
      "Nro Unidades / Lotes": "#ContentPlaceHolder1_lblNrUnidadeLotes",
      "Data da Última Reunião Realizada":
        "#ContentPlaceHolder1_lblDataReuniaoRealizada",
      "Voto da Reunião": "#ContentPlaceHolder1_lblDcVoto",
    };

    const data = Object.keys(RESULT_ATTRS_ELEMENTS).reduce((memo, key) => {
      const id = RESULT_ATTRS_ELEMENTS[key];
      const el = document.querySelector(id);
      memo[key] = el.textContent.trim();

      return memo;
    }, {});

    return data;
  }, selector);

  await browser.close();

  return result;
};

const convertToCSV = (results) => {
  const columns = Object.keys(results[0]);
  let fileContent = "";

  fileContent += columns.join(";");
  fileContent += "\n";

  fileContent += results.map((row) => {
    console.log(columns.map((column) => row[column]).join(";") + "\n");
    return columns.map((column) => row[column]).join(";") + "\n";
  });

  return fileContent;
};

/**
 * Sequelize
 */
const Sequelize = require("sequelize");

let sequelize = null;

if (env == "production") {
  sequelize = new Sequelize(process.env[config.use_env_variable], {
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false,
      },
    },
  });
} else {
  sequelize = new Sequelize({
    storage: process.env.DB_STORAGE || config.storage,
    dialect: process.env.DIALECT || config.dialect,
  });
}

const Property = sequelize.define("empreendimento", {
  numero: {
    type: Sequelize.STRING,
    unique: true,
  },
  interessado: {
    type: Sequelize.STRING,
  },
  empreendimento: {
    type: Sequelize.STRING,
  },
  municipio: {
    type: Sequelize.STRING,
  },
  dataEntrada: {
    type: Sequelize.STRING,
  },
  dataUltimaReuniaoPrevista: {
    type: Sequelize.STRING,
  },
  assuntoReuniao: {
    type: Sequelize.STRING,
  },
  certificado: {
    type: Sequelize.STRING,
  },
  situacao: {
    type: Sequelize.STRING,
  },
  tipoEmpreendimento: {
    type: Sequelize.STRING,
  },
  numUnidadesLotes: {
    type: Sequelize.STRING,
  },
  dataUltimaReuniaoRealizada: {
    type: Sequelize.STRING,
  },
  votoReuniao: {
    type: Sequelize.STRING,
  },
});

const propertyToJSON = (propertyFromDatabase, includeUpdatedAt = false) => {
  return {
    Número: propertyFromDatabase.numero,
    Interessado: propertyFromDatabase.interessado,
    Empreendimento: propertyFromDatabase.empreendimento,
    Município: propertyFromDatabase.municipio,
    "Data Entrada": propertyFromDatabase.dataEntrada,
    "Data da Última Reunião Prevista":
      propertyFromDatabase.dataUltimaReuniaoPrevista,
    "Assunto da Reunião": propertyFromDatabase.assuntoReuniao,
    Certificado: propertyFromDatabase.certificado,
    Situação: propertyFromDatabase.situacao,
    "Tipo Empreendimento": propertyFromDatabase.tipoEmpreendimento,
    "Nro Unidades / Lotes": propertyFromDatabase.numUnidadesLotes,
    "Data da Última Reunião Realizada":
      propertyFromDatabase.dataUltimaReuniaoRealizada,
    "Voto da Reunião": propertyFromDatabase.votoReuniao,
    "Últ Consulta": propertyFromDatabase.updatedAt,
  };
};

const savePropertyToDatabase = (result) => {
  const data = {
    numero: result["Número"],
    interessado: result["Interessado"],
    empreendimento: result["Empreendimento"],
    municipio: result["Município"],
    dataEntrada: result["Data Entrada"],
    dataUltimaReuniaoPrevista: result["Data da Última Reunião Prevista"],
    assuntoReuniao: result["Assunto da Reunião"],
    certificado: result["Certificado"],
    situacao: result["Situação"],
    tipoEmpreendimento: result["Tipo Empreendimento"],
    numUnidadesLotes: result["Nro Unidades / Lotes"],
    dataUltimaReuniaoRealizada: result["Data da Última Reunião Realizada"],
    votoReuniao: result["Voto da Reunião"],
  };

  return Property.upsert(data);
};

const findAllProperties = () => {
  return Property.sync().then(() => {
    return Property.findAll({
      order: [["numero", "ASC"]],
    });
  });
};

/**
 * Express App
 */
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const path = require("path");
const { query, validationResult } = require("express-validator");

const app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.set("port", process.env.PORT || 3000);
app.use(express.static(path.join(__dirname, "public")));
app.use(cors());

app.get("/saved-properties", (req, res) => {
  findAllProperties().then((results) => {
    res.send(results.map((result) => propertyToJSON(result, true)));
  });
});

const fetchAndSaveProperty = (reference) => {
  return queryProperty(reference).then((result) => {
    return Property.sync().then(() => savePropertyToDatabase(result));
  });
};

app.get("/property", [query("reference").exists()], (req, res) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(422).json({ errors: errors.mapped() });
  }

  const { reference } = req.query;

  fetchAndSaveProperty(reference).then((result) => res.send(result));
});

app.get("/download-file", (req, res) => {
  findAllProperties().then((results) => {
    const fs = require("fs");
    const fileContent = convertToCSV(
      results.map((result) => propertyToJSON(result))
    );
    const fileName = "results.csv";

    return fs.writeFile(fileName, fileContent, "ascii", (err) => {
      if (err) {
        return console.log(err);
      }

      const file = __dirname + "/" + fileName;
      res.download(file);
    });
  });
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname + "/public/index.html"));
});

app.listen(app.get("port"), () => console.log("Graprohab app listening!"));
