"use strict";
var modelRefs = {};

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

  set value(newValue){
    this.validate(newValue);
    this._value = newValue;
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

class IntegerField extends BaseField {
  constructor(params) {
    super(params)
    this.min = params.min || null;
    this.max = params.max || null;
  }

  validate(value) {
    super.validate(value);

    if (typeof value !== "number") {
      throw new Error("Value '" + value + "' is not a number.");
    } else if (value.length < this.min) {
      throw new Error("Value '" + value + "' is smaller than the minimum of " + this.min + ".");
    } else if (value.length < this.max) {
      throw new Error("Value '" + value + "' is greater than the maximum of " + this.max + ".");
    }
  }
}

class ListField extends BaseField {
  constructor(fieldClass, fieldArgs, params) {
    params.default = params.default || [];

    super(params)
    this.fieldClass = fieldClass;
    this.fieldArgs = fieldArgs;
    this.min_length = params.min_length || 0;
    this.max_length = params.max_length || null;
  }

  validate(value) {
    super.validate(value);

    if (value.length < this.min_length) {
      throw new Error("Value '" + value + "' is too short; it must have at least " + this.min_length + " elements.");
    } else if (this.max_length != null && value.length > this.max_length) {
      throw new Error("Value '" + value + "' is too long; it must have no more than " + this.max_length + " elements.");
    }
  }

  serialize() {
    let values = [];

    for (let index = 0; index < this.value.length; index += 1) {
      values.push(this.value[index].serialize());
    }

    return values;
  }

  deserialize(data) {
    let values = [];

    for (let index = 0; index < data.length; index += 1) {
      let field = this.fieldClass(...this.fieldArgs);
      values.push(field.deserialize(data[index]));
    }

    return values;
  }

  push(...values) {
    for (let index = 0; index < values.length; index += 1) {
      let field = this.fieldClass(...this.fieldArgs);
      field.value = values[index];
      this._value.push(field);
    }

    return this._value.length;
  }

  pop() {
    return this._value.pop();
  }
}

class ModelField extends BaseField {
  constructor(modelName, params) {
    super(params)
    this.modelName = modelName;
  }

  serialize() {
    return this.value.id;
  }

  deserialize(data) {
    let model = modelMap[this.modelName];
    let ret = new model(data);
    if (ret._temp) {
      return ret._temp;
    }
    return ret;
  }

  get value() {
    if (typeof this._value == "string") {
      let model = modelRefs[this.modelName][this._value];
      if (model != undefined) {
        this._value = model;
      }
    }

    return this._value;
  }

  set value(newValue) {
    this.validate(newValue);
    this._value = newValue;
  }
}

class DictField extends BaseField {
  constructor(params) {
    params.default = params.default || {}
    super(params)
  }
}


class BaseModel {
  constructor(data) {
    let modelName = this._modelName();
    if (typeof data == "string") {
      let model = modelRefs[modelName][data];
      if (model == undefined) {
        this._temp = data;
        return;
      } else {
        return model;
      }
    }

    let id = data.id;
    if (id in modelRefs[modelName]) {
      return modelRefs[modelName][id];
    }

    this.id = id;
    this._fields = this._getFields()

    for (let field in this._fields) {
      Object.defineProperty(this, field, {
        "enumerable": true,
        "get": () => this._fields[field],
      })
      this._fields[field].value = this._fields[field].deserialize(data[field]);
    }

    modelRefs[modelName][id] = this;
  }

  _modelName() { throw new Error("Not yet implemented!") }
  _getFields() { throw new Error("Not yet implemented!") }
}

class Web extends BaseModel {
  _modelName() { return "Web"; }
  _getFields() {
    return {
      "name": new StringField({default: "", placeholder: "Untitled"}),
      "graph": new ModelField("Graph", {}),
    }
  }
}

class Graph extends BaseModel {
  _modelName() { return "Graph"; }
  _getFields() {
    return {
      "nodes": new ListField(ModelField, ["Node", {}], {}),
      // "links": new ListField(ModelField, ["Link", {}], {}),
    }
  }
}

class Node extends BaseModel {
  _modelName() { return "Node"; }
  _getFields() {
    return {
      "subgraphs": new ListField(ModelField, ["Graph", {}], {}),
      "data": new DictField({}),
    }
  }
}


var modelMap = {
  "Web": Web,
  "Graph": Graph,
  "Node": Node,
  // "Link": Link,
}
for (let modelName in modelMap) {
  modelRefs[modelName] = {};
}


var data = {
  "Graph": {
    "5abdab31f10d9bfd190e5755": {
      "data": {},
      "links": [],
      "nodes": [],
      "id": "5abdab31f10d9bfd190e5755"
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

let myWeb = new Web(data["Web"]["5abdab31f10d9bfd190e5756"]);

// console.log(myWeb.name.value); // test
// myWeb.name.value = "example";
// myWeb.name.value = 5; // error!
// console.log(myWeb.name.value); // example

// myWeb.visibility.value = "hello"; // error!
// myWeb.visibility.value = "public"; // fine since it's "private", "shared", or "public"


// myWeb.save();













