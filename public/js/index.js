import { createApp } from "vue";
// import { moment }  from "moment";

createApp({ 
  methods: {
    rowColor: function (row) {
      /*if (moment().diff(row.updatedAt, "days") > 1) {
        return "color: red;";
      }*/

      return "";
    },
    queryAllProperties: function () {
      var self = this;
      var references = self.rows.map((row) => row["Número"]);

      this.loading = true;
      this.counter = 0;
      this.total = self.rows.length;

      const promiseSerial = (funcs) =>
        funcs.reduce(
          (promise, func) =>
            promise.then((result) => {
              self.counter++;
              return func().then(Array.prototype.concat.bind(result));
            }),
          Promise.resolve([])
        );

      const funcs = references.map(
        (reference) => () => fetch("/property?reference=" + reference)
      );

      promiseSerial(funcs).then((result) => {
        this.loading = false;
        self.fetchSavedProperties();
      });
    },
    updateProperty: function ($event, query) {
      this.queryProperty(query);
    },
    queryProperty: function (query) {
      var self = this;
      var q = this.query || query;
      this.loading = true;
      this.counter = 0;
      this.total = 1;

      this.counter++;

      fetch("/property?reference=" + q).then(function (response) {
        const contentType = response.headers.get("content-type");

        if (contentType && contentType.indexOf("application/json") !== -1) {
          //          console.log(response.json())

          return response.json().then(function (json) {
            self.loading = false;
            self.query = "";
            self.fetchSavedProperties();
          });
        }
      });
    },
    setSavedPropertiesData: function (json) {
      if (!json || json.length === 0) {
        return;
      }
      this.headers = Object.keys(json[0]);
      this.rows = json;
    },
    fetchSavedProperties: function () {
      var self = this;

      self.loading = true;

      fetch("/saved-properties").then(function (response) {
        const contentType = response.headers.get("content-type");

        if (contentType && contentType.indexOf("application/json") !== -1) {
          return response.json().then(function (json) {
            self.setSavedPropertiesData(json);
            self.loading = false;
          });
        }
      });
    },
  },
  setup() {
    // self.fetchSavedProperties();
  },
  data() {
    return {
      title: "Graprohab",
      headers: [],
      rows: [],
      loading: false,
      query: "",
      counter: 0,
      total: 0,
    };
  },
}).mount("#app");
