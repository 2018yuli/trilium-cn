"use strict";

const Entity = require('./entity');
const Attribute = require('./attribute');
const protectedSessionService = require('../services/protected_session');
const repository = require('../services/repository');
const sql = require('../services/sql');
const utils = require('../services/utils');
const dateUtils = require('../services/date_utils');
const syncTableService = require('../services/sync_table');

const LABEL = 'label';
const LABEL_DEFINITION = 'label-definition';
const RELATION = 'relation';
const RELATION_DEFINITION = 'relation-definition';

/**
 * This represents a Note which is a central object in the Trilium Notes project.
 *
 * @property {string} noteId - primary key
 * @property {string} type - one of "text", "code", "file" or "render"
 * @property {string} mime - MIME type, e.g. "text/html"
 * @property {string} title - note title
 * @property {int} contentLength - length of content
 * @property {boolean} isProtected - true if note is protected
 * @property {boolean} isDeleted - true if note is deleted
 * @property {string|null} deleteId - ID identifying delete transaction
 * @property {boolean} isErased - true if note's content is erased after it has been deleted
 * @property {string} dateCreated - local date time (with offset)
 * @property {string} dateModified - local date time (with offset)
 * @property {string} utcDateCreated
 * @property {string} utcDateModified
 *
 * @extends Entity
 */
class Note extends Entity {
    static get entityName() { return "notes"; }
    static get primaryKeyName() { return "noteId"; }
    static get hashedProperties() { return ["noteId", "title", "type", "mime", "isProtected", "isDeleted", "deleteId"]; }

    /**
     * @param row - object containing database row from "notes" table
     */
    constructor(row) {
        super(row);

        this.isProtected = !!this.isProtected;
        /* true if content is either not encrypted
         * or encrypted, but with available protected session (so effectively decrypted) */
        this.isContentAvailable = true;

        // check if there's noteId, otherwise this is a new entity which wasn't encrypted yet
        if (this.isProtected && this.noteId) {
            this.isContentAvailable = protectedSessionService.isProtectedSessionAvailable();

            if (this.isContentAvailable) {
                this.title = protectedSessionService.decryptString(this.title);
            }
            else {
                this.title = "[protected]";
            }
        }
    }

    /*
     * Note content has quite special handling - it's not a separate entity, but a lazily loaded
     * part of Note entity with it's own sync. Reasons behind this hybrid design has been:
     *
     * - content can be quite large and it's not necessary to load it / fill memory for any note access even if we don't need a content, especially for bulk operations like search
     * - changes in the note metadata or title should not trigger note content sync (so we keep separate utcDateModified and sync rows)
     * - but to the user note content and title changes are one and the same - single dateModified (so all changes must go through Note and content is not a separate entity)
     */

    /** @returns {Promise<*>} */
    async getContent(silentNotFoundError = false) {
        if (this.content === undefined) {
            const res = await sql.getRow(`SELECT content, hash FROM note_contents WHERE noteId = ?`, [this.noteId]);

            if (!res) {
                if (silentNotFoundError) {
                    return undefined;
                }
                else {
                    throw new Error("Cannot find note content for noteId=" + this.noteId);
                }
            }

            this.content = res.content;

            if (this.isProtected) {
                if (this.isContentAvailable) {
                    this.content = this.content === null ? null : protectedSessionService.decrypt(this.content);
                }
                else {
                    this.content = "";
                }
            }
        }

        if (this.isStringNote()) {
            return this.content === null
                ? ""
                : this.content.toString("UTF-8");
        }
        else {
            return this.content;
        }
    }

    /** @returns {Promise<*>} */
    async getJsonContent() {
        const content = await this.getContent();

        if (!content || !content.trim()) {
            return null;
        }

        return JSON.parse(content);
    }

    /** @returns {Promise} */
    async setContent(content) {
        if (content === null || content === undefined) {
            throw new Error(`Cannot set null content to note ${this.noteId}`);
        }

        content = Buffer.isBuffer(content) ? content : Buffer.from(content);

        // force updating note itself so that dateModified is represented correctly even for the content
        this.forcedChange = true;
        this.contentLength = content.byteLength;
        await this.save();

        this.content = content;

        const pojo = {
            noteId: this.noteId,
            content: content,
            utcDateModified: dateUtils.utcNowDateTime(),
            hash: utils.hash(this.noteId + "|" + content.toString())
        };

        if (this.isProtected) {
            if (this.isContentAvailable) {
                pojo.content = protectedSessionService.encrypt(pojo.content);
            }
            else {
                throw new Error(`Cannot update content of noteId=${this.noteId} since we're out of protected session.`);
            }
        }

        await sql.upsert("note_contents", "noteId", pojo);

        await syncTableService.addNoteContentSync(this.noteId);
    }

    /** @returns {Promise} */
    async setJsonContent(content) {
        await this.setContent(JSON.stringify(content, null, '\t'));
    }

    /** @returns {boolean} true if this note is the root of the note tree. Root note has "root" noteId */
    isRoot() {
        return this.noteId === 'root';
    }

    /** @returns {boolean} true if this note is of application/json content type */
    isJson() {
        return this.mime === "application/json";
    }

    /** @returns {boolean} true if this note is JavaScript (code or attachment) */
    isJavaScript() {
        return (this.type === "code" || this.type === "file")
            && (this.mime.startsWith("application/javascript")
                || this.mime === "application/x-javascript"
                || this.mime === "text/javascript");
    }

    /** @returns {boolean} true if this note is HTML */
    isHtml() {
        return (this.type === "code" || this.type === "file" || this.type === "render") && this.mime === "text/html";
    }

    /** @returns {boolean} true if the note has string content (not binary) */
    isStringNote() {
        return utils.isStringNote(this.type, this.mime);
    }

    /** @returns {string} JS script environment - either "frontend" or "backend" */
    getScriptEnv() {
        if (this.isHtml() || (this.isJavaScript() && this.mime.endsWith('env=frontend'))) {
            return "frontend";
        }

        if (this.type === 'render') {
            return "frontend";
        }

        if (this.isJavaScript() && this.mime.endsWith('env=backend')) {
            return "backend";
        }

        return null;
    }

    async loadOwnedAttributesToCache() {
        this.__ownedAttributeCache = await repository.getEntities(`SELECT * FROM attributes WHERE isDeleted = 0 AND noteId = ?`, [this.noteId]);
        return this.__ownedAttributeCache;
    }

    /**
     * This method is a faster variant of getAttributes() which looks for only owned attributes.
     * Use when inheritance is not needed and/or in batch/performance sensitive operations.
     *
     * @param {string} [type] - (optional) attribute type to filter
     * @param {string} [name] - (optional) attribute name to filter
     * @returns {Promise<Attribute[]>} note's "owned" attributes - excluding inherited ones
     */
    async getOwnedAttributes(type, name) {
        if (!this.__ownedAttributeCache) {
            await this.loadOwnedAttributesToCache();
        }

        if (type && name) {
            return this.__ownedAttributeCache.filter(attr => attr.type === type && attr.name === name);
        }
        else if (type) {
            return this.__ownedAttributeCache.filter(attr => attr.type === type);
        }
        else if (name) {
            return this.__ownedAttributeCache.filter(attr => attr.name === name);
        }
        else {
            return this.__ownedAttributeCache.slice();
        }
    }

    /**
     * @returns {Promise<Attribute>} attribute belonging to this specific note (excludes inherited attributes)
     *
     * This method can be significantly faster than the getAttribute()
     */
    async getOwnedAttribute(type, name) {
        const attrs = await this.getOwnedAttributes(type, name);

        return attrs.length > 0 ? attrs[0] : null;
    }

    /**
     * @returns {Promise<Attribute[]>} relations targetting this specific note
     */
    async getTargetRelations() {
        return await repository.getEntities("SELECT * FROM attributes WHERE type = 'relation' AND isDeleted = 0 AND value = ?", [this.noteId]);
    }

    /**
     * @param {string} [type] - (optional) attribute type to filter
     * @param {string} [name] - (optional) attribute name to filter
     * @returns {Promise<Attribute[]>} all note's attributes, including inherited ones
     */
    async getAttributes(type, name) {
        if (!this.__attributeCache) {
            await this.loadAttributesToCache();
        }

        if (type && name) {
            return this.__attributeCache.filter(attr => attr.type === type && attr.name === name);
        }
        else if (type) {
            return this.__attributeCache.filter(attr => attr.type === type);
        }
        else if (name) {
            return this.__attributeCache.filter(attr => attr.name === name);
        }
        else {
            return this.__attributeCache.slice();
        }
    }

    /**
     * @param {string} [name] - label name to filter
     * @returns {Promise<Attribute[]>} all note's labels (attributes with type label), including inherited ones
     */
    async getLabels(name) {
        return await this.getAttributes(LABEL, name);
    }

    /**
     * @param {string} [name] - label name to filter
     * @returns {Promise<Attribute[]>} all note's labels (attributes with type label), excluding inherited ones
     */
    async getOwnedLabels(name) {
        return await this.getOwnedAttributes(LABEL, name);
    }

    /**
     * @param {string} [name] - label name to filter
     * @returns {Promise<Attribute[]>} all note's label definitions, including inherited ones
     */
    async getLabelDefinitions(name) {
        return await this.getAttributes(LABEL_DEFINITION, name);
    }

    /**
     * @param {string} [name] - relation name to filter
     * @returns {Promise<Attribute[]>} all note's relations (attributes with type relation), including inherited ones
     */
    async getRelations(name) {
        return await this.getAttributes(RELATION, name);
    }

    /**
     * @param {string} [name] - relation name to filter
     * @returns {Promise<Attribute[]>} all note's relations (attributes with type relation), excluding inherited ones
     */
    async getOwnedRelations(name) {
        return await this.getOwnedAttributes(RELATION, name);
    }

    /**
     * @param {string} [name] - relation name to filter
     * @returns {Promise<Note[]>}
     */
    async getRelationTargets(name) {
        const relations = await this.getRelations(name);
        const targets = [];

        for (const relation of relations) {
            targets.push(await relation.getTargetNote());
        }

        return targets;
    }

    /**
     * @param {string} [name] - relation name to filter
     * @returns {Promise<Attribute[]>} all note's relation definitions including inherited ones
     */
    async getRelationDefinitions(name) {
        return await this.getAttributes(RELATION_DEFINITION, name);
    }

    /**
     * Clear note's attributes cache to force fresh reload for next attribute request.
     * Cache is note instance scoped.
     */
    invalidateAttributeCache() {
        this.__attributeCache = null;
        this.__ownedAttributeCache = null;
    }

    /** @returns {Promise<void>} */
    async loadAttributesToCache() {
        const attributes = await repository.getEntities(`
            WITH RECURSIVE
            tree(noteId, level) AS (
                SELECT ?, 0
                UNION
                SELECT branches.parentNoteId, tree.level + 1 
                    FROM branches
                    JOIN tree ON branches.noteId = tree.noteId
                WHERE branches.isDeleted = 0
            ),
            treeWithAttrs(noteId, level) AS (
                SELECT * FROM tree
                UNION
                SELECT attributes.value, treeWithAttrs.level FROM attributes
                     JOIN treeWithAttrs ON treeWithAttrs.noteId = attributes.noteId
                WHERE attributes.isDeleted = 0
                  AND attributes.type = 'relation'
                  AND attributes.name = 'template'
                  AND (treeWithAttrs.level = 0 OR attributes.isInheritable = 1)
                )
            SELECT attributes.* FROM attributes JOIN treeWithAttrs ON attributes.noteId = treeWithAttrs.noteId
            WHERE attributes.isDeleted = 0 AND (attributes.isInheritable = 1 OR treeWithAttrs.level = 0)
            ORDER BY level, noteId, position`, [this.noteId]);
        // attributes are ordered so that "closest" attributes are first
        // we order by noteId so that attributes from same note stay together. Actual noteId ordering doesn't matter.

        const filteredAttributes = attributes.filter((attr, index) => {
            // if this exact attribute already appears then don't include it (can happen via cloning)
            if (attributes.findIndex(it => it.attributeId === attr.attributeId) !== index) {
                return false;
            }

            if (attr.isDefinition()) {
                const firstDefinitionIndex = attributes.findIndex(el => el.type === attr.type && el.name === attr.name);

                // keep only if this element is the first definition for this type & name
                return firstDefinitionIndex === index;
            }
            else {
                const definitionAttr = attributes.find(el => el.type === attr.type + '-definition' && el.name === attr.name);

                if (!definitionAttr) {
                    return true;
                }

                const definition = definitionAttr.value;

                if (definition.multiplicityType === 'multivalue') {
                    return true;
                }
                else {
                    const firstAttrIndex = attributes.findIndex(el => el.type === attr.type && el.name === attr.name);

                    // in case of single-valued attribute we'll keep it only if it's first (closest)
                    return firstAttrIndex === index;
                }
            }
        });

        this.__attributeCache = filteredAttributes;
    }

    /**
     * @param {string} type - attribute type (label, relation, etc.)
     * @param {string} name - attribute name
     * @returns {Promise<boolean>} true if note has an attribute with given type and name (including inherited)
     */
    async hasAttribute(type, name) {
        return !!await this.getAttribute(type, name);
    }

    /**
     * @param {string} type - attribute type (label, relation, etc.)
     * @param {string} name - attribute name
     * @returns {Promise<boolean>} true if note has an attribute with given type and name (excluding inherited)
     */
    async hasOwnedAttribute(type, name) {
        return !!await this.getOwnedAttribute(type, name);
    }

    /**
     * @param {string} type - attribute type (label, relation, etc.)
     * @param {string} name - attribute name
     * @returns {Promise<Attribute>} attribute of given type and name. If there's more such attributes, first is  returned. Returns null if there's no such attribute belonging to this note.
     */
    async getAttribute(type, name) {
        const attributes = await this.getAttributes();

        return attributes.find(attr => attr.type === type && attr.name === name);
    }

    /**
     * @param {string} type - attribute type (label, relation, etc.)
     * @param {string} name - attribute name
     * @returns {Promise<string|null>} attribute value of given type and name or null if no such attribute exists.
     */
    async getAttributeValue(type, name) {
        const attr = await this.getAttribute(type, name);

        return attr ? attr.value : null;
    }

    /**
     * @param {string} type - attribute type (label, relation, etc.)
     * @param {string} name - attribute name
     * @returns {Promise<string|null>} attribute value of given type and name or null if no such attribute exists.
     */
    async getOwnedAttributeValue(type, name) {
        const attr = await this.getOwnedAttribute(type, name);

        return attr ? attr.value : null;
    }

    /**
     * Based on enabled, attribute is either set or removed.
     *
     * @param {string} type - attribute type ('relation', 'label' etc.)
     * @param {boolean} enabled - toggle On or Off
     * @param {string} name - attribute name
     * @param {string} [value] - attribute value (optional)
     * @returns {Promise<void>}
     */
    async toggleAttribute(type, enabled, name, value) {
        if (enabled) {
            await this.setAttribute(type, name, value);
        }
        else {
            await this.removeAttribute(type, name, value);
        }
    }

    /**
     * Update's given attribute's value or creates it if it doesn't exist
     *
     * @param {string} type - attribute type (label, relation, etc.)
     * @param {string} name - attribute name
     * @param {string} [value] - attribute value (optional)
     * @returns {Promise<void>}
     */
    async setAttribute(type, name, value) {
        const attributes = await this.loadOwnedAttributesToCache();
        let attr = attributes.find(attr => attr.type === type && attr.name === name);

        if (attr) {
            if (attr.value !== value) {
                attr.value = value;
                await attr.save();

                this.invalidateAttributeCache();
            }
        }
        else {
            attr = new Attribute({
                noteId: this.noteId,
                type: type,
                name: name,
                value: value !== undefined ? value : ""
            });

            await attr.save();

            this.invalidateAttributeCache();
        }
    }

    /**
     * Removes given attribute name-value pair if it exists.
     *
     * @param {string} type - attribute type (label, relation, etc.)
     * @param {string} name - attribute name
     * @param {string} [value] - attribute value (optional)
     * @returns {Promise<void>}
     */
    async removeAttribute(type, name, value) {
        const attributes = await this.loadOwnedAttributesToCache();

        for (const attribute of attributes) {
            if (attribute.type === type && attribute.name === name && (value === undefined || value === attribute.value)) {
                attribute.isDeleted = true;
                await attribute.save();

                this.invalidateAttributeCache();
            }
        }
    }

    /**
     * @return {Promise<Attribute>}
     */
    async addAttribute(type, name, value = "", isInheritable = false) {
        const attr = new Attribute({
            noteId: this.noteId,
            type: type,
            name: name,
            value: value,
            isInheritable: isInheritable
        });

        await attr.save();

        this.invalidateAttributeCache();

        return attr;
    }

    async addLabel(name, value = "", isInheritable = false) {
        return await this.addAttribute(LABEL, name, value, isInheritable);
    }

    async addRelation(name, targetNoteId, isInheritable = false) {
        return await this.addAttribute(RELATION, name, targetNoteId, isInheritable);
    }

    /**
     * @param {string} name - label name
     * @returns {Promise<boolean>} true if label exists (including inherited)
     */
    async hasLabel(name) { return await this.hasAttribute(LABEL, name); }

    /**
     * @param {string} name - label name
     * @returns {Promise<boolean>} true if label exists (excluding inherited)
     */
    async hasOwnedLabel(name) { return await this.hasOwnedAttribute(LABEL, name); }

    /**
     * @param {string} name - relation name
     * @returns {Promise<boolean>} true if relation exists (including inherited)
     */
    async hasRelation(name) { return await this.hasAttribute(RELATION, name); }

    /**
     * @param {string} name - relation name
     * @returns {Promise<boolean>} true if relation exists (excluding inherited)
     */
    async hasOwnedRelation(name) { return await this.hasOwnedAttribute(RELATION, name); }

    /**
     * @param {string} name - label name
     * @returns {Promise<Attribute|null>} label if it exists, null otherwise
     */
    async getLabel(name) { return await this.getAttribute(LABEL, name); }

    /**
     * @param {string} name - label name
     * @returns {Promise<Attribute|null>} label if it exists, null otherwise
     */
    async getOwnedLabel(name) { return await this.getOwnedAttribute(LABEL, name); }

    /**
     * @param {string} name - relation name
     * @returns {Promise<Attribute|null>} relation if it exists, null otherwise
     */
    async getRelation(name) { return await this.getAttribute(RELATION, name); }

    /**
     * @param {string} name - relation name
     * @returns {Promise<Attribute|null>} relation if it exists, null otherwise
     */
    async getOwnedRelation(name) { return await this.getOwnedAttribute(RELATION, name); }

    /**
     * @param {string} name - label name
     * @returns {Promise<string|null>} label value if label exists, null otherwise
     */
    async getLabelValue(name) { return await this.getAttributeValue(LABEL, name); }

    /**
     * @param {string} name - label name
     * @returns {Promise<string|null>} label value if label exists, null otherwise
     */
    async getOwnedLabelValue(name) { return await this.getOwnedAttributeValue(LABEL, name); }

    /**
     * @param {string} name - relation name
     * @returns {Promise<string|null>} relation value if relation exists, null otherwise
     */
    async getRelationValue(name) { return await this.getAttributeValue(RELATION, name); }

    /**
     * @param {string} name - relation name
     * @returns {Promise<string|null>} relation value if relation exists, null otherwise
     */
    async getOwnedRelationValue(name) { return await this.getOwnedAttributeValue(RELATION, name); }

    /**
     * @param {string} name
     * @returns {Promise<Note>|null} target note of the relation or null (if target is empty or note was not found)
     */
    async getRelationTarget(name) {
        const relation = await this.getRelation(name);

        return relation ? await repository.getNote(relation.value) : null;
    }

    /**
     * @param {string} name
     * @returns {Promise<Note>|null} target note of the relation or null (if target is empty or note was not found)
     */
    async getOwnedRelationTarget(name) {
        const relation = await this.getOwnedRelation(name);

        return relation ? await repository.getNote(relation.value) : null;
    }

    /**
     * Based on enabled, label is either set or removed.
     *
     * @param {boolean} enabled - toggle On or Off
     * @param {string} name - label name
     * @param {string} [value] - label value (optional)
     * @returns {Promise<void>}
     */
    async toggleLabel(enabled, name, value) { return await this.toggleAttribute(LABEL, enabled, name, value); }

    /**
     * Based on enabled, relation is either set or removed.
     *
     * @param {boolean} enabled - toggle On or Off
     * @param {string} name - relation name
     * @param {string} [value] - relation value (noteId)
     * @returns {Promise<void>}
     */
    async toggleRelation(enabled, name, value) { return await this.toggleAttribute(RELATION, enabled, name, value); }

    /**
     * Update's given label's value or creates it if it doesn't exist
     *
     * @param {string} name - label name
     * @param {string} [value] - label value
     * @returns {Promise<void>}
     */
    async setLabel(name, value) { return await this.setAttribute(LABEL, name, value); }

    /**
     * Update's given relation's value or creates it if it doesn't exist
     *
     * @param {string} name - relation name
     * @param {string} [value] - relation value (noteId)
     * @returns {Promise<void>}
     */
    async setRelation(name, value) { return await this.setAttribute(RELATION, name, value); }

    /**
     * Remove label name-value pair, if it exists.
     *
     * @param {string} name - label name
     * @param {string} [value] - label value
     * @returns {Promise<void>}
     */
    async removeLabel(name, value) { return await this.removeAttribute(LABEL, name, value); }

    /**
     * Remove relation name-value pair, if it exists.
     *
     * @param {string} name - relation name
     * @param {string} [value] - relation value (noteId)
     * @returns {Promise<void>}
     */
    async removeRelation(name, value) { return await this.removeAttribute(RELATION, name, value); }

    /**
     * @return {Promise<string[]>} return list of all descendant noteIds of this note. Returning just noteIds because number of notes can be huge. Includes also this note's noteId
     */
    async getDescendantNoteIds() {
        return await sql.getColumn(`
            WITH RECURSIVE
            tree(noteId) AS (
                SELECT ?
                UNION
                SELECT branches.noteId FROM branches
                    JOIN tree ON branches.parentNoteId = tree.noteId
                    JOIN notes ON notes.noteId = branches.noteId
                WHERE notes.isDeleted = 0
                  AND branches.isDeleted = 0
            )
            SELECT noteId FROM tree`, [this.noteId]);
    }

    /**
     * Finds descendant notes with given attribute name and value. Only own attributes are considered, not inherited ones
     *
     * @param {string} type - attribute type (label, relation, etc.)
     * @param {string} name - attribute name
     * @param {string} [value] - attribute value
     * @returns {Promise<Note[]>}
     */
    async getDescendantNotesWithAttribute(type, name, value) {
        const params = [this.noteId, name];
        let valueCondition = "";

        if (value !== undefined) {
            params.push(value);
            valueCondition = " AND attributes.value = ?";
        }

        const notes = await repository.getEntities(`
            WITH RECURSIVE
            tree(noteId) AS (
                SELECT ?
                UNION
                SELECT branches.noteId FROM branches
                    JOIN tree ON branches.parentNoteId = tree.noteId
                    JOIN notes ON notes.noteId = branches.noteId
                WHERE notes.isDeleted = 0
                  AND branches.isDeleted = 0
            )
            SELECT notes.* FROM notes 
            JOIN tree ON tree.noteId = notes.noteId
            JOIN attributes ON attributes.noteId = notes.noteId
            WHERE attributes.isDeleted = 0 
              AND attributes.name = ?
              ${valueCondition} 
            ORDER BY noteId, position`, params);

        return notes;
    }

    /**
     * Finds descendant notes with given label name and value. Only own labels are considered, not inherited ones
     *
     * @param {string} name - label name
     * @param {string} [value] - label value
     * @returns {Promise<Note[]>}
     */
    async getDescendantNotesWithLabel(name, value) { return await this.getDescendantNotesWithAttribute(LABEL, name, value); }

    /**
     * Finds descendant notes with given relation name and value. Only own relations are considered, not inherited ones
     *
     * @param {string} name - relation name
     * @param {string} [value] - relation value
     * @returns {Promise<Note[]>}
     */
    async getDescendantNotesWithRelation(name, value) { return await this.getDescendantNotesWithAttribute(RELATION, name, value); }

    /**
     * Returns note revisions of this note.
     *
     * @returns {Promise<NoteRevision[]>}
     */
    async getRevisions() {
        return await repository.getEntities("SELECT * FROM note_revisions WHERE noteId = ?", [this.noteId]);
    }

    /**
     * Get list of links coming out of this note.
     *
     * @deprecated - not intended for general use
     * @returns {Promise<Attribute[]>}
     */
    async getLinks() {
        return await repository.getEntities(`
            SELECT * 
            FROM attributes 
            WHERE noteId = ? AND 
                  isDeleted = 0 AND
                  type = 'relation' AND
                  name IN ('internalLink', 'imageLink', 'relationMapLink', 'includeNoteLink')`, [this.noteId]);
    }

    /**
     * @returns {Promise<Branch[]>}
     */
    async getBranches() {
        return await repository.getEntities("SELECT * FROM branches WHERE isDeleted = 0 AND noteId = ?", [this.noteId]);
    }

    /**
     * @returns {boolean} - true if note has children
     */
    async hasChildren() {
        return (await this.getChildNotes()).length > 0;
    }

    /**
     * @returns {Promise<Note[]>} child notes of this note
     */
    async getChildNotes() {
        return await repository.getEntities(`
          SELECT notes.* 
          FROM branches 
            JOIN notes USING(noteId) 
          WHERE notes.isDeleted = 0
                AND branches.isDeleted = 0
                AND branches.parentNoteId = ?
          ORDER BY branches.notePosition`, [this.noteId]);
    }

    /**
     * @returns {Promise<Branch[]>} child branches of this note
     */
    async getChildBranches() {
        return await repository.getEntities(`
          SELECT branches.* 
          FROM branches 
          WHERE branches.isDeleted = 0
                AND branches.parentNoteId = ?
          ORDER BY branches.notePosition`, [this.noteId]);
    }

    /**
     * @returns {Promise<Note[]>} parent notes of this note (note can have multiple parents because of cloning)
     */
    async getParentNotes() {
        return await repository.getEntities(`
          SELECT parent_notes.* 
          FROM 
            branches AS child_tree 
            JOIN notes AS parent_notes ON parent_notes.noteId = child_tree.parentNoteId 
          WHERE child_tree.noteId = ?
                AND child_tree.isDeleted = 0
                AND parent_notes.isDeleted = 0`, [this.noteId]);
    }

    /**
     * @return {Promise<string[][]>} - array of notePaths (each represented by array of noteIds constituting the particular note path)
     */
    async getAllNotePaths() {
        if (this.noteId === 'root') {
            return [['root']];
        }

        const notePaths = [];

        for (const parentNote of await this.getParentNotes()) {
            for (const parentPath of await parentNote.getAllNotePaths()) {
                parentPath.push(this.noteId);
                notePaths.push(parentPath);
            }
        }

        return notePaths;
    }

    /**
     * @param ancestorNoteId
     * @return {Promise<boolean>} - true if ancestorNoteId occurs in at least one of the note's paths
     */
    async isDescendantOfNote(ancestorNoteId) {
        const notePaths = await this.getAllNotePaths();

        return notePaths.some(path => path.includes(ancestorNoteId));
    }

    beforeSaving() {
        if (!this.isDeleted) {
            this.isDeleted = false;
        }

        if (!this.dateCreated) {
            this.dateCreated = dateUtils.localNowDateTime();
        }

        if (!this.utcDateCreated) {
            this.utcDateCreated = dateUtils.utcNowDateTime();
        }

        if (this.contentLength === undefined) {
            this.contentLength = -1;
        }

        super.beforeSaving();

        if (this.isChanged) {
            this.dateModified = dateUtils.localNowDateTime();
            this.utcDateModified = dateUtils.utcNowDateTime();
        }
    }

    // cannot be static!
    updatePojo(pojo) {
        if (pojo.isProtected) {
            if (this.isContentAvailable) {
                pojo.title = protectedSessionService.encrypt(pojo.title);
            }
            else {
                // updating protected note outside of protected session means we will keep original ciphertexts
                delete pojo.title;
            }
        }

        delete pojo.isContentAvailable;
        delete pojo.__attributeCache;
        delete pojo.__ownedAttributeCache;
        delete pojo.content;
        /** zero references to contentHash, probably can be removed */
        delete pojo.contentHash;
    }
}

module.exports = Note;
