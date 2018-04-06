"use strict";

class BaseField {
  constructor(params) {
    this.default = params.default || null;
    this.nullable = params.nullable || false;

    this._value = this.default;
  }

  serialize() {
    return this.value;
  }

  deserialize(data) {
    return data;
  }

  get value(){
    return this._value
  }

  set value(new_value){
    this.validate(new_value);
    this._value = new_value;
  }

  validate(value) {
    if (value == null && !this.nullable) {
      throw new Error("New value cannot be '" + value + "'.");
    }
  }

  inputBox() {
    throw new Error("Not yet implemented.");
  }
}

class StringField extends BaseField {
  constructor(params) {
    super(params)
    this.min_length = params.min_length || 0;
    this.max_length = params.max_length || null;
    this.placeholder = params.placeholder || "";
  }

  validate(value) {
    super.validate(value);

    if (typeof value !== "string") {
      throw new Error("Value '" + value + "' is not a string.");
    } else if (value.length < this.min_length) {
      throw new Error("Value '" + value + "' is too short; it must be at least " + this.min_length + " characters.");
    } else if (this.max_length != null && value.length > this.max_length) {
      throw new Error("Value '" + value + "' is too long; it must be no more than " + this.max_length + " characters long.");
    }
  }
}


class BaseModel {
  constructor() {}
}



var data = {
  "Graph": {
    "5abdab31f10d9bfd190e5755": {
      "data": {},
      "links": [],
      "nodes": []
    }
  },
  "Web": {
    "5abdab31f10d9bfd190e5756": {
      "data": {},
      "edges": [],
      "graph": "5abdab31f10d9bfd190e5755",
      "id": "5abdab31f10d9bfd190e5756",
      "name": "test",
      "owner": "SfPprVAZYUSJQfUEpCHh",
      "rules": [],
      "vertices": [],
      "visibility": "private"
    }
  }
};

function Web(data) {
  let new_web = {
    _fields: {
      "name": new StringField({default: "", placeholder: "Untitled"}),
    },

    get name(){
      return this._fields.name;
    },
  }

  for (let field in new_web._fields) {
    new_web[field].value = new_web[field].deserialize(data[field]);
  }

  return new_web
}

let myWeb = Web(data["Web"]["5abdab31f10d9bfd190e5756"]);

// console.log(myWeb.name.value); // test
// myWeb.name.value = "example";
// myWeb.name.value = 5; // error!
// console.log(myWeb.name.value); // example

// myWeb.visibility.value = "hello"; // error!
// myWeb.visibility.value = "public"; // fine since it's "private", "shared", or "public"


// myWeb.save();













