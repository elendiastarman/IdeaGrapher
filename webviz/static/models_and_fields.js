'use strict';
/* global d3:false */

if (typeof Proxy == 'undefined') {
    throw new Error('This browser doesn\'t support Proxy.');
}

class BaseField {
  constructor(params) {
    this.default = params.default === undefined ? null : params.default;
    this.nullable = params.nullable || false;

    this._value = this.default;
    this._input = null;
    this._dirty = false;
  }

  _getType() {
    throw new Error('Field type not yet defined!');
  }

  serialize() {
    return this.value;
  }

  deserialize(data) {
    if (data === undefined) {
      return this.default;
    }
    return data;
  }

  get value() {
    return this._value;
  }

  set value(newValue) {
    if (newValue === undefined) {
      newValue = this.default;
    }
    this.validate(newValue);
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
      throw new Error('New value cannot be \'' + value + '\'.');
    }
  }

  addInput(container, editable) {
    throw new Error('Input method not yet implemented!');
  }

  setIfDifferent(newValue) {
    if (this.value != newValue) {
      this.value = newValue;
    }
  }

  applyChanges() {
    throw new Error('Method for applying changes not yet implemented!');
  }

  applyDefaultInputStyling(input, editable) {
    let tempFunc = function(item){ return function(){ item.applyChanges(); }; };
    input
      .style('width', '95%')
      .property('disabled', !editable)
      .on('focusout', tempFunc(this))
      .on('change', tempFunc(this));
  }
}

class StringField extends BaseField {
  constructor(params) {
    super(params);
    this.min_length = params.min_length || 0;
    this.max_length = params.max_length || null;
    this.placeholder = params.placeholder || '';
  }

  _getType() {
    return 'string';
  }

  validate(value) {
    super.validate(value);

    if (value == null) { return; }

    if (typeof value !== 'string') {
      throw new Error('Value \'' + value + '\' is not a string.');
    } else if (value.length < this.min_length) {
      throw new Error('Value \'' + value + '\' is too short; it must be at least ' + this.min_length + ' characters.');
    } else if (this.max_length != null && value.length > this.max_length) {
      throw new Error('Value \'' + value + '\' is too long; it must be no more than ' + this.max_length + ' characters long.');
    }
  }

  addInput(container, editable) {
    let input = container.append('input')
      .property('value', this.value);
    this.applyDefaultInputStyling(input, editable);
    this._input = input;
  }

  applyChanges() {
    this.setIfDifferent(this._input.property('value'));
  }
}

class TextField extends StringField {
  _getType() {
    return 'text';
  }

  addInput(container, editable) {
    let input = container.append('textarea')
      .property('value', this.value == null ? '' : this.value)
      .style('height', '100px');
    this.applyDefaultInputStyling(input, editable);
    this._input = input;
  }
}

class BooleanField extends BaseField {
  constructor(params) {
    super(params);
    this.default = params.default || false;
  }

  _getType() {
    return 'boolean';
  }

  validate(value) {
    super.validate(value);

    if (value == null) { return; }

    if (typeof value !== 'boolean') {
      throw new Error('Value \'' + value + '\' is not a boolean.');
    }
  }

  addInput(container, editable) {
    let input = container.append('input')
      .attr('type', 'checkbox')
      .property('checked', this.value);
    this.applyDefaultInputStyling(input, editable);
    this._input = input;
  }

  applyChanges() {
    this.setIfDifferent(this._input.node().checked);
  }
}

class NumberField extends BaseField {
  constructor(params) {
    super(params);
    this.min = params.min || null;
    this.max = params.max || null;
  }

  _getType() {
    return 'number';
  }

  validate(value) {
    super.validate(value);

    if (value == null) { return; }

    if (typeof value !== 'number') {
      throw new Error('Value \'' + value + '\' is not a number.');
    } else if (value.length < this.min) {
      throw new Error('Value \'' + value + '\' is less than the minimum of ' + this.min + '.');
    } else if (value.length < this.max) {
      throw new Error('Value \'' + value + '\' is greater than the maximum of ' + this.max + '.');
    }
  }

  addInput(container, editable) {
    let input = container.append('input')
      .attr('type', 'number')
      .property('value', this.value);
    this.applyDefaultInputStyling(input, editable);

    if (this.min) {
      input.attr('min', this.min);
    }
    if (this.max) {
      input.attr('max', this.max);
    }

    this._input = input;
  }

  applyChanges() {
    this.setIfDifferent(Number(this._input.property('value')));
  }
}

class ListField extends BaseField {
  constructor(fieldClass, fieldArgs, params) {
    params.default = params.default || [];

    super(params);
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

    if (value == null) { return; }

    if (value.length < this.min_length) {
      throw new Error('Value \'' + value + '\' is too short; it must have at least ' + this.min_length + ' elements.');
    } else if (this.max_length != null && value.length > this.max_length) {
      throw new Error('Value \'' + value + '\' is too long; it must have no more than ' + this.max_length + ' elements.');
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

  get value() {
    if (this.fieldClass == ModelField) {
      for (let index in this._value) {
        if (typeof this._value[index] == 'string') {
          let field = new this.fieldClass(...this.fieldArgs);
          this._value[index] = field.deserialize(this._value[index]);
        }
      }
    }
    return this._value;
  }

  set value(newValue) {
    newValue = newValue === undefined ? this.default : newValue;

    for (let index in newValue) {
      let field = new this.fieldClass(...this.fieldArgs);
      newValue[index] = field.deserialize(newValue[index]);
    }

    this.validate(newValue);
    this._value = newValue;
    this._dirty = true;
  }

  push(...values) {
    for (let index in values) {
      if (this.fieldClass == ModelField && values[index] instanceof modelMap[this.fieldArgs[0]]) {
        this._value.push(values[index]);
      } else {
        let field = new this.fieldClass(...this.fieldArgs);
        this._value.push(field.deserialize(values[index]));
      }
    }

    this._dirty = true;
    return this._value.length;
  }

  pop() {
    this._dirty = true;
    return this._value.pop();
  }

  splice(index, maxNum) {
    this._dirty = true;
    return this._value.splice(index, maxNum);
  }

  addInputElement(container, element, editable) {
    if (this.fieldClass == ModelField) {
      element._populateContainer(container);
    } else {
      element.addInput(container, editable);
    }
  }

  addInput(container, editable) {
    let temp = container.append('div');
    this._input = temp;

    let randomId = Math.random().toString().slice(2);
    let div = this._input.append('div')
      .attr('id', randomId);

    div.append('a')
      .attr('id', 'show' + randomId)
      .attr('href', '').text('show ' + this.value.length + ' items')
      .property('hidden', false)
      .on('click', function() {
        d3.event.preventDefault();
        d3.select('#show' + randomId).property('hidden', true);
        d3.select('#hide' + randomId).property('hidden', false);
        d3.select('#input' + randomId).property('hidden', false);
      });

    div.append('a')
      .attr('id', 'hide' + randomId)
      .attr('href', '').text('hide ' + this.value.length + ' items')
      .property('hidden', true)
      .on('click', function() {
        d3.event.preventDefault();
        d3.select('#show' + randomId).property('hidden', false);
        d3.select('#hide' + randomId).property('hidden', true);
        d3.select('#input' + randomId).property('hidden', true);
      });

    let inputDiv = div.append('div')
      .attr('id', 'input' + randomId)
      .style('padding', '5px')
      .style('border-left', '2px solid black')
      .property('hidden', true);

    inputDiv.append('hr');
    for (let index in this.value) {
      this.addInputElement(inputDiv.append('div'), this.value[index], editable);
    }
    inputDiv.append('hr');

    if (!editable) {
      return;
    }

    let tempFunc = function(box, self, canEdit){ return function(){
      d3.event.preventDefault();
      if (self.fieldClass == ModelField) {
        let model = modelMap[self.fieldArgs[0]];
        let newModel = new model(model._defaultData(), false);
        self.push(newModel);
      } else {
        self.push({});
      }
      self.addInputElement(box, self.value[self.value.length - 1], canEdit);
    }; };
    div.append('br');
    div.append('a')
      .attr('id', 'add' + randomId)
      .attr('href', '').text('+ Add one')
      .on('click', tempFunc(inputDiv, this, editable));
  }
}

class EnumField extends BaseField {
  constructor(params) {
    super(params);
    this.choices = params.choices || [];

    if (this.choices.length < 1) {
      throw new Error('EnumField needs at least one choice.');
    }
  }

  _getType() {
    return 'enum';
  }

  validate(value) {
    super.validate(value);

    if (value == null) { return; }

    if (typeof value !== 'string') {
      throw new Error('Value \'' + value + '\' is not a string.');
    } else if (this.choices.indexOf(value) == -1) {
      throw new Error('Value \'' + value + '\' is not in the choices \'' + this.choices + '\'.');
    }
  }

  addInput(container, editable) {
    let input = container.append('select');

    for (let choice of this.choices) {
      let option = input.append('option')
        .attr('value', choice)
        .html(choice);

      if (choice == this.value) {
        option.property('selected', true);
      }
    }

    this.applyDefaultInputStyling(input, editable);
    this._input = input;
  }

  applyChanges() {
    this.setIfDifferent(this._input.node().value);
  }
}

class ModelField extends BaseField {
  constructor(modelName, params) {
    super(params);
    this.modelName = modelName;

    let model = modelMap[this.modelName];
    if (model === undefined) {
      throw new Error('You dummy, you forgot to update modelMap to include' + this.modelName + '.');
    }

    let fields = model.prototype._getFields();

    for (let field in fields) {
      Object.defineProperty(this, field, {
        'enumerable': true,
        'get': () => this._value[field],
      });
    }
  }

  _getType() {
    return 'model';
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
    if (typeof this._value == 'string') {
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
    let temp = container.append('div');
    this._input = temp;

    let input = temp.append('input')
      .attr('class', 'input')
      .property('value', this.value.id);
    this.applyDefaultInputStyling(input, editable);

    let randomId = Math.random().toString().slice(2);
    let div = this._input.append('div')
      .attr('id', randomId);

    div.append('a')
      .attr('id', 'show' + randomId)
      .attr('href', '').text('show')
      .property('hidden', false)
      .on('click', function() {
        d3.event.preventDefault();
        d3.select('#show' + randomId).property('hidden', true);
        d3.select('#hide' + randomId).property('hidden', false);
        d3.select('#input' + randomId).property('hidden', false);
      });

    div.append('a')
      .attr('id', 'hide' + randomId)
      .attr('href', '').text('hide')
      .property('hidden', true)
      .on('click', function() {
        d3.event.preventDefault();
        d3.select('#show' + randomId).property('hidden', false);
        d3.select('#hide' + randomId).property('hidden', true);
        d3.select('#input' + randomId).property('hidden', true);
      });

    let inputDiv = div.append('div')
      .attr('id', 'input' + randomId)
      .style('padding', '5px')
      .style('border-left', '2px solid black')
      .property('hidden', true);

    inputDiv.append('hr');
    this.value._populateContainer(inputDiv);
    inputDiv.append('hr');
  }

  applyChanges() {
    this.setIfDifferent(this._input.select('.input').property('value'));
  }
}

class DictField extends BaseField {
  constructor(params) {
    params.default = params.default || {};
    super(params);

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
        target._dirty = true;
        return target._value[name];
      }
    });

    return proxy;
  }

  _getType() {
    return 'dict';
  }

  addInput(container, editable) {
    let input = container.append('textarea')
      .property('value', JSON.stringify(this.value, null, 2))
      .style('height', '100px');
    this.applyDefaultInputStyling(input, editable);
    this._input = input;
  }

  applyChanges() {
    let newValue = this._input.property('value');
    if (newValue != JSON.stringify(this.value, null, 2)) {
      this.value = JSON.parse(newValue);
    }
  }
}

class NestedField extends BaseField {
  constructor(params) {
    params.default = params.default || {};
    super(params);
    this._fields = params._fields;

    for (let field in this._fields) {
      Object.defineProperty(this, field, {
        'enumerable': true,
        'get': () => this._fields[field].value,
        'set': (newValue) => {this._fields[field].value = newValue;},
      });
    }
  }

  _getType() {
    return 'nested';
  }

  serialize() {
    let values = {};

    for (let field in this._fields) {
      values[field] = this._fields[field].serialize();
    }

    return values;
  }

  get value() {
    let values = {};

    for (let field in this._fields) {
      values[field] = this._fields[field].value;
    }

    return values;
  }

  set value(newValue) {
    for (let field in this._fields) {
      this._fields[field].value = this._fields[field].deserialize(newValue[field]);
    }
  }

  isDirty() {
    let changedBool = false;
    let changedDict = {};

    for (let field in this._fields) {
      let [dirtyBool, dirtyValue] = this._fields[field].isDirty();
      changedBool = changedBool || dirtyBool;

      if (dirtyBool) {
        changedDict[field] = dirtyValue;
      }
    }

    return [changedBool, changedDict];
  }

  markClean() {
    for (let field in this._fields) {
      this._fields[field].markClean();
    }
  }

  addInput(container, editable) {
    let randomId = Math.random().toString().slice(2);
    let inputDiv = container.append('div')
      .attr('id', 'input' + randomId)
      .style('padding', '5px')
      .style('border-left', '2px solid black');

    for (let index in editable) {
      let [name, canEdit] = editable[index];
      inputDiv.append('p')
        .html('<em>' + name + '</em>')
        .style('margin-bottom', 0)
        .style('margin-top', index == 0 ? '0px' : '5px');
      this._fields[name].addInput(inputDiv, canEdit);
    }
  }
}


function snakify(name) {
  return name.replace(/[A-Z]/g, function(match){ return '_' + match.toLowerCase(); });
}


class BaseModel {
  constructor(data, deserializing) {
    let modelName = this._modelName();
    if (typeof data == 'string') {
      let model = modelRefs[modelName][data];
      if (model == undefined) {
        this._temp = data;
        return;
      } else {
        return model;
      }
    }

    let id = data.id;
    let modRef = modelRefs[modelName][id];
    if (modRef !== undefined) {
      return modRef;
    }

    this.id = id;
    this._fields = this._getFields();

    for (let fieldName in this._fields) {
      let field = this._fields[fieldName];
      Object.defineProperty(this, fieldName, {
        'enumerable': true,
        'get': () => field,
      });
      field.value = field.deserialize(data[snakify(fieldName)]);

      if (field instanceof ModelField || field instanceof ListField && field.fieldClass == ModelField) {
        let values = [];

        if (field instanceof ModelField) {
          values = [field.value];
        } else {
          values = field.value;
        }

        for (let val of values) {
          let key = val.id;
          if (key == undefined) {
            key = val;
          }

          let ref = crossReference[key];
          if (ref == undefined) {
            crossReference[key] = {};
            ref = crossReference[key];
          }

          let modelName = this._modelName();
          if (ref[modelName] == undefined) {
            ref[modelName] = [];
          }

          if (ref[modelName].indexOf(this.id) == -1) {
            ref[modelName].push(this.id);
          }
        }
      }
    }

    modelRefs[modelName][id] = this;

    if (deserializing === false) {
      addDirtyModel(this, 'create');
    } else {
      this._markClean();
    }
  }

  static _defaultData() { throw new Error('Default data not yet defined!'); }

  _modelName() { throw new Error('Model name not yet defined!'); }
  _getFields() { throw new Error('Fields not yet defined!'); }
  _getDataFields() { throw new Error('Data fields not yet defined!'); }

  _populateContainer(container) {
    // assumes that container is a div within a foreignObject handled by D3
    container.append('p').html(this._modelName() + ': ' + this.id);
    container.select('p').append('br');
    container.select('p').append('a')
      .attr('href', '')
      .html('Delete')
      .style('color', 'red')
      .on('click', function(self){
        return function(){
          d3.event.preventDefault();
          cascadeDeletes(self);
        };
      }(this));

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

class Document extends BaseModel {
  _modelName() { return 'Document'; }
  _getFields() {
    return {
      'name': new StringField({default: '', placeholder: 'Untitled'}),
      'webs': new ListField(ModelField, ['Web', {}], {}),
      'rules': new ListField(ModelField, ['Rule', {}], {}),
      'data': new DictField({}),
    };
  }

  _getDataFields() {
    return [
      ['name', true],
      ['webs', false],
      ['rules', true],
      ['data', true],
    ];
  }
}

class Rule extends BaseModel {
  constructor(...args) {
    super(...args);

    this._filterFunc = null;
    if (this.filterFunc.value != null) {
      this._filterFunc = new Function('return ' + this.filterFunc.value)();
    }

    this._transformFunc = null;
    if (this.transformFunc.value != null) {
      this._transformFunc = new Function('return ' + this.transformFunc.value)();
    }

    this._interval = null; // for startInterval and cancelInterval
  }

  _modelName() { return 'Rule'; }
  _getFields() {
    return {
      'name': new StringField({default: '', placeholder: 'Untitled'}),
      'active': new BooleanField({default: false}),
      'trigger': new EnumField({choices: ['button', 'tick', 'change', 'periodic'], default: 'button'}),
      'frequency': new NumberField({nullable: true, min: 1}),
      'targetModel': new EnumField({choices: ['Document', 'Rule', 'Web', 'Edge', 'Vertex', 'Graph', 'Link', 'Node'], default: 'Vertex'}),
      'filterFunc': new TextField({nullable: true}),
      'transformFunc': new TextField({nullable: true}),
      'data': new DictField({}),
    };
  }

  _getDataFields() {
    return [
      ['name', true],
      ['active', true],
      ['trigger', true],
      ['frequency', true],
      ['targetModel', true],
      ['filterFunc', true],
      ['transformFunc', true],
      ['data', true],
    ];
  }

  static _defaultData(extraData) {
    let data = {
      'id': objectIdStockpile.pop(),
    };

    if (extraData) {
      if (extraData['data']) {
        data['data'] = Object.assign({}, data['data'], extraData['data']);
        delete extraData['data'];
      }
      data = Object.assign({}, data, extraData);
    }

    return data;
  }

  _populateContainer(container) {
    super._populateContainer(container);

    let tempFunc = function(self){ return function(){ self._applyRule(); }; };
    container.insert('button', 'p + p')
      .attr('id', 'apply' + this.id)
      .html('Apply')
      .on('click', tempFunc(this));
  }

  _applyRule() {
    let targetModel = this.targetModel.value;
    console.log('applying rule on ' + targetModel);

    if (this.transformFunc.value == null || this.transformFunc.value == '') {
      this._transformFunc = null;
    } else {
      this._transformFunc = new Function('return ' + this.transformFunc.value)();
    }

    if (this._transformFunc == null) {
      console.log('transformFunc is null');
      return;
    }

    for (let key in modelRefs[targetModel]) {
      let objData = modelRefs[targetModel][key];
      let svgId = targetModel == 'Web' ? 'web' + objData.id : objData.id;
      let objSVG = d3.select('[id=\'' + svgId + '\']');

      this._transformFunc({'id': objData.id, 'data': objData, 'svgId': svgId, 'objSVG': objSVG});
    }
  }
}

class Web extends BaseModel {
  _modelName() { return 'Web'; }
  _getFields() {
    return {
      'name': new StringField({default: '', placeholder: 'Untitled'}),
      'graph': new ModelField('Graph', {}),
      'vertices': new ListField(ModelField, ['Vertex', {}], {}),
      'edges': new ListField(ModelField, ['Edge', {}], {}),
      'screen': new NestedField({'_fields': {
        'x': new NumberField({'default': 0}),
        'y': new NumberField({'default': 0}),
        'scale': new NumberField({'default': 3}),
      }}),
      'data': new DictField({}),
    };
  }

  _getDataFields() {
    return [
      ['name', true],
      ['graph', false],
      ['vertices', false],
      ['edges', false],
      ['screen', [
        ['x', true],
        ['y', true],
        ['scale', true],
      ]],
      ['data', true],
    ];
  }

  static _defaultData(extraData) {
    let data = {
      'id': objectIdStockpile.pop(),
    };

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

class Edge extends BaseModel {
  _modelName() { return 'Edge'; }

  _getFields() {
    return {
      'link': new ModelField('Link', {}),
      'kind': new EnumField({choices: ['connected', 'directed', 'related'], default: 'connected'}),
      'screen': new NestedField({'_fields': {
        'thickness': new NumberField({'default': 3}),
        'color': new StringField({'default': 'black'}),
      }}),
      'startVertices': new ListField(ModelField, ['Vertex', {}], {}),
      'endVertices': new ListField(ModelField, ['Vertex', {}], {}),
      'data': new DictField({}),
    };
  }

  _getDataFields() {
    return [
      ['link', false],
      ['kind', true],
      ['screen', [
        ['thickness', true],
        ['color', true],
      ]],
      ['startVertices', false],
      ['endVertices', false],
      ['data', true],
    ];
  }

  static _defaultData(extraData) {
    let data = {
      'id': objectIdStockpile.pop(),
    };

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

class Vertex extends BaseModel {
  _modelName() { return 'Vertex'; }

  _getFields() {
    return {
      'node': new ModelField('Node', {}),
      'subwebs': new ListField(ModelField, ['Web', {}], {}),
      'screen': new NestedField({'_fields': {
        'x': new NumberField({'default': 0}),
        'y': new NumberField({'default': 0}),
        'xv': new NumberField({'default': 0}),
        'yv': new NumberField({'default': 0}),
        'size': new NumberField({'default': 100}),
        'color': new StringField({'default': 'gray'}),
      }}),
      'data': new DictField({}),
    };
  }

  _getDataFields() {
    return [
      ['node', false],
      ['screen', [
        ['x', true],
        ['y', true],
        ['xv', true],
        ['yv', true],
        ['size', true],
        ['color', true],
      ]],
      ['subwebs', false],
      ['data', true],
    ];
  }

  static _defaultData(extraData) {
    let data = {
      'id': objectIdStockpile.pop(),
      'screen': {
        'x': 0, 'y': 0, 'xv': 0, 'yv': 0,
        'color': 'gray', 'size': 100,
      }
    };

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
  _modelName() { return 'Graph'; }
  _getFields() {
    return {
      'nodes': new ListField(ModelField, ['Node', {}], {}),
      'links': new ListField(ModelField, ['Link', {}], {}),
      'data': new DictField({}),
    };
  }

  _getDataFields() {
    return [
      ['nodes', false],
      ['links', false],
      ['data', true],
    ];
  }

  static _defaultData(extraData) {
    let data = {
      'id': objectIdStockpile.pop(),
    };

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

class Link extends BaseModel {
  _modelName() { return 'Link'; }

  _getFields() {
    return {
      'sources': new ListField(ModelField, ['Node', {}], {}),
      'sinks': new ListField(ModelField, ['Node', {}], {}),
      'data': new DictField({}),
    };
  }

  _getDataFields() {
    return [
      ['sources', false],
      ['sinks', false],
      ['data', true],
    ];
  }

  static _defaultData(extraData) {
    let data = {
      'id': objectIdStockpile.pop(),
    };

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

class Node extends BaseModel {
  _modelName() { return 'Node'; }

  _getFields() {
    return {
      'subgraphs': new ListField(ModelField, ['Graph', {}], {}),
      'data': new DictField({}),
    };
  }

  _getDataFields() {
    return [
      ['subgraphs', false],
      ['data', true],
    ];
  }

  static _defaultData(extraData) {
    let data = {
      'id': objectIdStockpile.pop(),
    };

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

class ModelLookup {
  constructor(model) {
    this._model = model;
    this.models = {};
    this.modelIds = [];
    this.newModelIds = [];
  }

  add(instance) {
    let modelId = instance.id;
    if (modelId == undefined) {
      console.log(instance);
      throw new Error('Model id is not defined in this data ^');
    }

    if (this.modelIds.indexOf(modelId) > -1) {
      return this.models[modelId];
    }

    this.modelIds.push(modelId);
    this.newModelIds.push(modelId);
    this.models[modelId] = instance;

    Object.defineProperty(this, modelId, {
      'enumerable': true,
      'get': () => this.models[modelId],
    });

    return this[modelId];
  }

  index(num) {
    if (num < 0) {
      num += this.modelIds.length;
    }
    return this.models[this.modelIds[num]];
  }

  remove(modelId) {
    let index = this.modelIds.indexOf(modelId);
    if (index == -1) {
      return 0;
    }

    this.modelIds.splice(index, 1);
    delete this.models[modelId];

    return 1;
  }

  [Symbol.iterator]() {
    return {
      'current': 0,
      'models': this.models,
      'modelIds': this.modelIds,
      next() {
        if (this.current < this.modelIds.length) {
          return {'done': false, 'value': this.models[this.modelIds[this.current++]]};
        } else {
          return {'done': true};
        }
      }
    };
  }

  clearNew() {
    this.newModelIds = [];
  }
}

var dependencyOrder = ['Node', 'Vertex', 'Link', 'Edge', 'Graph', 'Web', 'Rule', 'Document'];
var modelRefs = {};
var modelMap = {
  'Node': Node,
  'Vertex': Vertex,
  'Link': Link,
  'Edge': Edge,
  'Graph': Graph,
  'Web': Web,
  'Rule': Rule,
  'Document': Document,
};
for (let modelName in modelMap) {
  modelRefs[modelName] = {};
}

// For interacting with in render.js; modelRefs should be internal.
var models = {
  'Node': new ModelLookup(Node),
  'Vertex': new ModelLookup(Vertex),
  'Link': new ModelLookup(Link),
  'Edge': new ModelLookup(Edge),
  'Graph': new ModelLookup(Graph),
  'Web': new ModelLookup(Web),
  'Rule': new ModelLookup(Rule),
  'Document': new ModelLookup(Document),
};
var crossReference = {};
var needToSync = false;


function containedIn(smaller, larger) {
  if (smaller.length > larger.length) {
    return false;
  }

  for (let item of smaller) {
    if (larger.indexOf(item) == -1) {
      return false;
    }
  }

  return true;
}

function cascadeDeletes(instanceToDelete) {
  let modelsToDelete = [instanceToDelete];
  let idsToDelete = [instanceToDelete.id];
  let modelsToCascade = [instanceToDelete];

  let addToCascade = function(candidate) {
    if (candidate != undefined && idsToDelete.indexOf(candidate.id) == -1) {
      modelsToDelete.push(candidate);
      idsToDelete.push(candidate.id);
      modelsToCascade.push(candidate);
    }
  };

  let candidate, container, index;

  while (modelsToCascade.length > 0) {
    let nextModel = modelsToCascade.splice(0, 1)[0];

    // starting with Vertex (instead of Node) because it ended up being a good example of how to do this
    if (nextModel instanceof Vertex) {

      // Remove from referring things
      for (let webId of crossReference[nextModel.id]['Web']) {
        container = models['Web'][webId];
        if (container == undefined) {
          continue;
        }

        index = container.vertices.serialize().indexOf(nextModel.id);
        if (index > -1) {
          container.vertices.splice(index, 1);
        }
      }

      // Refers to a single thing
      candidate = nextModel.node.value;
      if (containedIn(crossReference[candidate.id]['Vertex'], idsToDelete)) {
        addToCascade(candidate);
      }

      // Refers to a list of things
      for (let subwebId of nextModel.subwebs.serialize()) {
        candidate = models['Web'][subwebId];
        if (candidate == undefined) {
          continue;
        }

        if (containedIn(crossReference[candidate.id]['Vertex'], idsToDelete)) {
          addToCascade(candidate);
        }
      }

      // Is referred to by things
      for (let edgeId of crossReference[nextModel.id]['Edge'] || []) {
        candidate = models['Edge'][edgeId];
        if (candidate == undefined) {
          continue;
        }

        let startVertices = candidate.startVertices.serialize();
        index = startVertices.indexOf(nextModel.id);
        if (index > -1) {
          candidate.startVertices.splice(index, 1);
        }

        let endVertices = candidate.endVertices.serialize();
        index = endVertices.indexOf(nextModel.id);
        if (index > -1) {
          candidate.endVertices.splice(index, 1);
        }

        if (containedIn(startVertices, idsToDelete) || containedIn(endVertices, idsToDelete)) {
          addToCascade(candidate);
        }
      }

    } else if (nextModel instanceof Node) {

      for (let graphId of crossReference[nextModel.id]['Graph']) {
        container = models['Graph'][graphId];
        if (container == undefined) {
          continue;
        }

        index = container.nodes.serialize().indexOf(nextModel.id);
        if (index > -1) {
          container.nodes.splice(index, 1);
        }
      }

      for (let subgraphId of nextModel.subgraphs.serialize()) {
        candidate = models['Graph'][subgraphId];
        if (candidate == undefined) {
          continue;
        }

        if (containedIn(crossReference[candidate.id]['Node'], idsToDelete)) {
          addToCascade(candidate);
        }
      }

      for (let vertexId of crossReference[nextModel.id]['Vertex']) {
        candidate = models['Vertex'][vertexId];
        addToCascade(candidate);
      }

      for (let linkId of crossReference[nextModel.id]['Link'] || []) {
        candidate = models['Link'][linkId];
        if (candidate == undefined) {
          continue;
        }

        if (containedIn(candidate.sources.serialize(), idsToDelete) || containedIn(candidate.sinks.serialize(), idsToDelete)) {
          addToCascade(candidate);
        }
      }

    } else if (nextModel instanceof Link) {

      for (let graphId of crossReference[nextModel.id]['Graph']) {
        container = models['Graph'][graphId];
        if (container == undefined) {
          continue;
        }

        index = container.links.serialize().indexOf(nextModel.id);
        if (index > -1) {
          container.links.splice(index, 1);
        }
      }

      for (let edgeId of crossReference[nextModel.id]['Edge']) {
        candidate = models['Edge'][edgeId];
        addToCascade(candidate);
      }

    } else if (nextModel instanceof Edge) {

      for (let webId of crossReference[nextModel.id]['Web']) {
        container = models['Web'][webId];
        if (container == undefined) {
          continue;
        }

        index = container.edges.serialize().indexOf(nextModel.id);
        if (index > -1) {
          container.edges.splice(index, 1);
        }
      }

      candidate = nextModel.link.value;
      if (containedIn(crossReference[candidate.id]['Edge'], idsToDelete)) {
        addToCascade(candidate);
      }

    } else if (nextModel instanceof Graph) {

      let doc = models['Document'].index(0);
      let dontDelete = false;
      for (let webId of doc.webs.serialize()) {
        container = models['Web'][webId];
        if (container == undefined) {
          continue;
        }

        if (container.graph.value.id == nextModel.id) {
          dontDelete = true;
          break;
        }
      }

      if (dontDelete) {
        idsToDelete.splice(idsToDelete.indexOf(nextModel.id), 1);
        continue;
      }

      for (let nodeId of crossReference[nextModel.id]['Node']) {
        container = models['Node'][nodeId];
        if (container == undefined) {
          continue;
        }

        index = container.subgraphs.serialize().indexOf(nextModel.id);
        if (index > -1) {
          container.subgraphs.splice(index, 1);
        }
      }

      for (let webId of crossReference[nextModel.id]['Web']) {
        candidate = models['Web'][webId];
        addToCascade(candidate);
      }

      for (let nodeId of nextModel.nodes.serialize()) {
        candidate = models['Node'][nodeId];
        if (candidate != undefined && containedIn(crossReference[candidate.id]['Graph'], idsToDelete)) {
          addToCascade(candidate);
        }
      }

      for (let linkId of nextModel.links.serialize()) {
        candidate = models['Link'][linkId];
        if (candidate != undefined && containedIn(crossReference[candidate.id]['Graph'], idsToDelete)) {
          addToCascade(candidate);
        }
      }

    } else if (nextModel instanceof Web) {

      let doc = models['Document'].index(0);
      let dontDelete = false;
      if (doc.webs.serialize().indexOf(nextModel.id) > -1) {
        dontDelete = true;
      }

      if (dontDelete) {
        idsToDelete.splice(idsToDelete.indexOf(nextModel.id), 1);
        continue;
      }

      candidate = nextModel.graph.value;
      if (containedIn(crossReference[candidate.id]['Web'], idsToDelete)) {
        addToCascade(candidate);
      }

      for (let vertexId of crossReference[nextModel.id]['Vertex']) {
        container = models['Vertex'][vertexId];
        if (container == undefined) {
          continue;
        }

        index = container.subwebs.serialize().indexOf(nextModel.id);
        if (index > -1) {
          container.subwebs.splice(index, 1);
        }
      }

      for (let vertexId of nextModel.vertices.serialize()) {
        candidate = models['Vertex'][vertexId];
        if (candidate != undefined && containedIn(crossReference[candidate.id]['Web'], idsToDelete)) {
          addToCascade(candidate);
        }
      }

      for (let edgeId of nextModel.edges.serialize()) {
        candidate = models['Edge'][edgeId];
        if (candidate != undefined && containedIn(crossReference[candidate.id]['Web'], idsToDelete)) {
          addToCascade(candidate);
        }
      }

    } else if (nextModel instanceof Rule) {
      let doc = models['Document'].index(0);
      index = doc.rules.serialize().indexOf(nextModel.id);
      doc.rules.splice(index, 1);
    }

    models[nextModel._modelName()].remove(nextModel.id);
    delete crossReference[nextModel.id];
  }

  for (let model of modelsToDelete) {
    addDirtyModel(model, 'delete');
  }

  needToSync = true;
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
          '$key': snakify(name),
        };

        if (datum['$type'] == 'model') {
          datum['$value'] = {'$model': field.modelName, '$id': field.serialize()};
        } else if (datum['$type'].slice(0, 4) == 'list') {
          let innerType = datum['$type'].slice(5);
          let innerData = field.serialize();
          datum['$value'] = [];
          for (let innerIndex in innerData) {
            if (innerType == 'model') {
              datum['$value'].push({'$model': field.fieldArgs[0], '$id': innerData[innerIndex]});
            } else {
              datum['$value'].push(innerData[innerIndex].serialize());
            }
          }
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
            '$key': snakify(key),
          };

          if (datum['$type'] == 'model') {
            datum['$value'] = {'$model': field.modelName, '$id': field.serialize()};
          } else if (datum['$type'].slice(0, 4) == 'list') {
            let innerType = datum['$type'].slice(5);
            let innerData = field.serialize();
            datum['$value'] = [];
            for (let innerIndex in innerData) {
              if (innerType == 'model') {
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

  for (let index in dirtyModelIds) {
    let [model, action] = dirtyModels[index];

    if (action == 'delete') {
      modelCommands.push({
        '$model': model._modelName(),
        '$id': model.id,
        '$delete': true,
      });
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
          clearInterval(saveTimer);
        }
      }
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
