"use strict";

const Entity = require('./entity');
const dateUtils = require('../services/date_utils');

/**
 * Option represents name-value pair, either directly configurable by the user or some system property.
 *
 * @property {string} name
 * @property {string} value
 * @property {boolean} isSynced
 * @property {string} utcDateModified
 * @property {string} utcDateCreated
 *
 * @extends Entity
 */
class Option extends Entity {
    static get entityName() { return "options"; }
    static get primaryKeyName() { return "name"; }
    static get hashedProperties() { return ["name", "value"]; }

    constructor(row) {
        super(row);

        this.isSynced = !!this.isSynced;
    }

    beforeSaving() {
        if (!this.utcDateCreated) {
            this.utcDateCreated = dateUtils.utcNowDateTime();
        }

        super.beforeSaving();

        if (this.isChanged) {
            this.utcDateModified = dateUtils.utcNowDateTime();
        }
    }
}

module.exports = Option;