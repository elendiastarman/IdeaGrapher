"use strict";
if (typeof Proxy == "undefined") {
    throw new Error("This browser doesn't support Proxy.");
}

class BaseField {
  constructor(params) {
    this.default = params.default || null;
    this.nullable = params.nullable || false;

    this._value = this.default;
    this._input = null;
    this._dirty = false;
  }

  _getType() {
    throw new Error("Field type not yet defined!");
  }

  serialize() {
    return this.value;
  }

  deserialize(data) {
    return data || this.default;
  }

  get value() {
    return this._value
  }

  set value(newValue) {
    this.validate(newValue);
    console.log('newValue:', newValue);
    this._value = newValue;
    this._dirty = true;
  }

  isDirty() {
    if (this._dirty) {
      return [true, this.serialize()];
    } else {
      return [false, null];
    }
  }

  markClean() {
    this._dirty = false;
  }

  validate(value) {
    if (value == null && !this.nullable) {
      throw new Error("New value cannot be '" + value + "'.");
    }
  }

  addInput(container, editable) {
    throw new Error("Input method not yet implemented!");
  }

  applyChanges() {
    throw new Error("Method for applying changes not yet implemented!");
  }

  applyDefaultInputStyling(editable) {
    let tempFunc = function(item){ return function(){ item.applyChanges(); } };
    this._input
      .style('width', '95%')
      .property('disabled', !editable)
      .on('focusout', tempFunc(this));
  }
}

class StringField extends BaseField {
  constructor(params) {
    super(params)
    this.min_length = params.min_length || 0;
    this.max_length = params.max_length || null;
    this.placeholder = params.placeholder || "";
  }

  _getType() {
    return "string";
  }

  validate(value) {
    super.validate(value);

    if (value == null) { return; }

    if (typeof value !== "string") {
      throw new Error("Value '" + value + "' is not a string.");
    } else if (value.length < this.min_length) {
      throw new Error("Value '" + value + "' is too short; it must be at least " + this.min_length + " characters.");
    } else if (this.max_length != null && value.length > this.max_length) {
      throw new Error("Value '" + value + "' is too long; it must be no more than " + this.max_length + " characters long.");
    }
  }

  addInput(container, editable) {
    this._input = container.append('input')
      .property('value', this.value)
      .style('width', '90%');
    this.applyDefaultInputStyling(editable);
  }

  applyChanges() {
    this.value = this._input.property('value');
  }
}

class IntegerField extends BaseField {
  constructor(params) {
    super(params)
    this.min = params.min || null;
    this.max = params.max || null;
  }

  _getType() {
    return "integer";
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

  _getType() {
    return 'list/' + this.fieldClass.prototype._getType();
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
      if (this.fieldClass.prototype._getType() == 'model') {
        values.push(this._value[index].id);
      } else {
        values.push(this._value[index].serialize());
      }
    }

    return values;
  }

  deserialize(data) {
    let values = [];

    if (data) {
      for (let index in data) {
        let field = new this.fieldClass(...this.fieldArgs);
        values.push(field.deserialize(data[index]));
      }
    }

    return values;
  }

  push(...values) {
    for (let index in values) {
      let field = new this.fieldClass(...this.fieldArgs);
      this._value.push(field.deserialize(values[index]));
    }

    this._dirty = true;
    return this._value.length;
  }

  pop() {
    this._dirty = true;
    return this._value.pop();
  }
}

class ModelField extends BaseField {
  constructor(modelName, params) {
    super(params)
    this.modelName = modelName;

    let model = modelMap[this.modelName];
    if (model === undefined) {
      throw new Error("You dummy, you forgot to update modelMap to include" + this.modelName + ".");
    }

    let fields = model.prototype._getFields();

    for (let field in fields) {
      Object.defineProperty(this, field, {
        "enumerable": true,
        "get": () => this._value[field],
      })
    }
  }

  _getType() {
    return "model";
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
    this._dirty = true;
    this._value = newValue;
  }

  addInput(container, editable) {
    this._input = container.append('input')
      .property('value', this.value.id);
    this.applyDefaultInputStyling(editable);
  }

  applyChanges() {
    this.value = this._input.property('value');
  }
}

class DictField extends BaseField {
  constructor(params) {
    params.default = params.default || {}
    super(params)

    let proxy = new Proxy(this, {
      get(target, name, receiver) {
        if (Reflect.has(target, name)) {
          return Reflect.get(target, name, receiver);
        }

        return target._value[name];
      },
      set(target, name, value, receiver) {
        if (Reflect.has(target, name)) {
          if (name == '_value') {
            target._dirty = true;
          }
          return Reflect.set(target, name, value, receiver);
        }

        target._value[name] = value;
        console.log('name:', name);
        target._dirty = true;
        return target._value[name];
      }
    })

    return proxy;
  }

  _getType() {
    return "dict";
  }

  addInput(container, editable) {
    this._input = container.append('textarea')
      .property('value', JSON.stringify(this.value, null, 2))
      .style('height', '100px');
    this.applyDefaultInputStyling(editable);
  }

  applyChanges() {
    this._value = JSON.parse(this._input.property('value'));
  }
}


class BaseModel {
  constructor(data, deserializing) {
    console.log(data, deserializing);
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

    if (deserializing === false) {
      addDirtyModel(this, 'create');
    } else {
      this._markClean();
    }
  }

  static _defaultData() { throw new Error("Default data not yet defined!") }

  _modelName() { throw new Error("Model name not yet defined!") }
  _getFields() { throw new Error("Fields not yet defined!") }
  _getDataFields() { throw new Error("Data fields not yet defined!") }

  _populateContainer(container) {
    // assumes that container is a div within a foreignObject handled by D3
    container.append('p').html(this._modelName() + ': ' + this.id);

    let dataFields = this._getDataFields();
    for (let index in dataFields) {
      let [name, editable] = dataFields[index];
      container.append('p').html('<strong>' + name + '</strong>');
      this._fields[name].addInput(container, editable);
    }
  }

  _isDirty() {
    let dirtyData = {};
    let dirtyBool = false;

    for (let field in this._fields) {
      let [dirty, value] = this._fields[field].isDirty();

      if (dirty) {
        dirtyData[field] = value;
        dirtyBool = true;
      }
    }

    return [dirtyBool, dirtyData];
  }
  _markClean() {
    for (let field in this._fields) {
      this._fields[field].markClean();
    }
  }
}

class Web extends BaseModel {
  _modelName() { return "Web"; }
  _getFields() {
    return {
      "name": new StringField({nullable: true, placeholder: "Untitled"}),
      "graph": new ModelField("Graph", {}),
      "vertices": new ListField(ModelField, ["Vertex", {}], {}),
    }
  }
}

class Vertex extends BaseModel {
  _modelName() { return "Vertex"; }

  _getFields() {
    return {
      "node": new ModelField("Node", {}),
      "subwebs": new ListField(ModelField, ["Web", {}], {}),
      "screen": new DictField({}),
      "data": new DictField({}),
    }
  }

  _getDataFields() {
    return [
      ['node', false],
      ['screen', true],
      ['data', true],
    ]
  }

  static _defaultData(extraData) {
    let data = {
      'id': objectIdStockpile.pop(),
      'screen': {
        'x': 0, 'y': 0, 'xv': 0, 'yv': 0,
        'color': 'gray',
      }
    }

    if (extraData) {
      if (extraData['screen']) {
        data['screen'] = Object.assign({}, data['screen'], extraData['screen']);
        delete extraData['screen'];
      }
      if (extraData['data']) {
        data['data'] = Object.assign({}, data['data'], extraData['data']);
        delete extraData['data'];
      }
      data = Object.assign({}, data, extraData);
    }

    return data;
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

  _getDataFields() {
    return [
      ['data', true],
    ]
  }

  static _defaultData(extraData) {
    let data = {
      'id': objectIdStockpile.pop(),
    }

    if (extraData) {
      if (extraData['data']) {
        data['data'] = Object.assign({}, data['data'], extraData['data']);
        delete extraData['data'];
      }
      data = Object.assign({}, data, extraData);
    }

    return data;
  }
}

var modelRefs = {};
var modelMap = {
  "Web": Web,
  "Vertex": Vertex,
  "Graph": Graph,
  "Node": Node,
  // "Link": Link,
}
var dependencyOrder = ['Node', 'Vertex', 'Graph', 'Web'];
for (let modelName in modelMap) {
  modelRefs[modelName] = {};
}

var minObjectIdAmount = 100;
var objectIdStockpile = [];
function restockObjectIds(num) {
  num = num || 100;
  $.ajax('/restockobjectids?count=' + num, {
    method: 'GET',
    success: function(responseData) {
      console.log('SUCCESS ', responseData.length);
      objectIdStockpile = responseData.concat(objectIdStockpile);
    },
    error: function(responseData) {
      console.log('ERROR ', responseData);
    },
  });
}

var dirtyModels = [];
var dirtyModelIds = [];
function addDirtyModel(model, action) {
  if (dirtyModelIds.indexOf(model.id) > -1) {
    return;
  }

  dirtyModels.push([model, action]);
  dirtyModelIds.push(model.id);
}

function saveDirtyModels() {
  if (objectIdStockpile.length < minObjectIdAmount) {
    restockObjectIds(2 * (minObjectIdAmount - objectIdStockpile.length));
  }

  let modelCommands = [];

  for (let index in dirtyModelIds) {
    let [model, action] = dirtyModels[index];

    if (action == 'create') {
      let createData = [];

      for (let name in model._getFields()) {
        let field = model._fields[name];
        let datum = {
          '$action': 'overwrite',
          '$type': field._getType(),
          '$key': name,
        };

        if (datum['$type'] == 'model') {
          datum['$value'] = {'$model': '', '$id': field.serialize()};
        } else {
          datum['$value'] = field.serialize();
        }

        createData.push(datum);
      }

      modelCommands.push({
        '$model': model._modelName(),
        '$id': model.id,
        '$create': createData,
      });

    } else if (action == 'delete') {
      modelCommands.push({
        '$model': model._modelName(),
        '$id': model.id,
        '$delete': true,
      });
    }
  }

  for (let index in dependencyOrder) {
    let modelName = dependencyOrder[index];

    for (let modelId in modelRefs[modelName]) {
      if (dirtyModelIds.indexOf(modelId) > -1) {
        continue;
      }

      let model = modelRefs[modelName][modelId];
      let [dirty, value] = model._isDirty();

      if (dirty) {
        let updateData = [];
        for (let key in value) {
          let field = model._fields[key];
          let datum = {
            '$action': 'overwrite',
            '$type': field._getType(),
            '$key': key,
          };

          if (datum['$type'] == 'model') {
            datum['$value'] = {'$model': field.modelName, '$id': field.serialize()};
          } else if (datum['$type'].slice(0, 4) == 'list') {
            let innerType = datum['$type'].slice(5);
            let innerData = field.serialize();
            datum['$value'] = [];
            for (let innerIndex in innerData) {
              if (innerType == 'model') {
                console.log('field:', field);
                datum['$value'].push({'$model': field.fieldArgs[0], '$id': innerData[innerIndex]});
              } else {
                datum['$value'].push(innerData[innerIndex].serialize());
              }
            }
          } else {
            datum['$value'] = field.serialize();
          }

          updateData.push(datum);
        }

        modelCommands.push({
          '$model': model._modelName(),
          '$id': model.id,
          '$update': updateData,
        });
      }
    }
  }

  if (modelCommands.length == 0) {
    return;
  }
  console.log('commands:', modelCommands);

  $.ajax('/updatedata', {
    method: 'PUT',
    data: {'data': JSON.stringify(modelCommands)},
    success: function(responseData) {
      console.log('SUCCESS ', responseData);
      responseData = responseData['return_data'];

      for (let index in responseData) {
        if (responseData[index]['data'] !== undefined) {
          let command = modelCommands[index];
          let model = modelRefs[command['$model']][command['$id']];
          model._markClean();

          let dirtyModelIndex = dirtyModelIds.indexOf(command['$id']);
          if (dirtyModelIndex > -1) {
            dirtyModelIds.splice(dirtyModelIndex, 1);
            dirtyModels.splice(dirtyModelIndex, 1);
          }
        } else {
          console.log('Error acting on model:', responseData[index], modelCommands[index]);
        }
      }

      drawSync();
    },
    error: function(responseData) {
      console.log('ERROR ', responseData);
    },
  });
}

var saveTimer;
var saveDelay = 1000;
saveDirtyModels();
saveTimer = setInterval(saveDirtyModels, saveDelay);
