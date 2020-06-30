import utils from "../../services/utils.js";
import linkService from "../../services/link.js";
import ws from "../../services/ws.js";
import CollapsibleWidget from "../collapsible_widget.js";

export default class AttributesWidget extends CollapsibleWidget {
    get widgetTitle() { return "属性"; }

    get help() {
        return {
            title: "属性是分配给此笔记的键值对。",
            url: "https://github.com/zadam/trilium/wiki/Attributes"
        };
    }

    get headerActions() {
        const $showFullButton = $("<a>").append("查看").addClass('widget-header-action');
        $showFullButton.on('click', async () => {
            const attributesDialog = await import("../../dialogs/attributes.js");
            attributesDialog.showDialog();
        });

        return [$showFullButton];
    }

    async refreshWithNote(note) {
        const ownedAttributes = note.getOwnedAttributes();
        const $attributesContainer = $("<div>");

        await this.renderAttributes(ownedAttributes, $attributesContainer);

        const $inheritedAttrs = $("<span>").append($("<strong>").text("Inherited: "));
        const $showInheritedAttributes = $("<a>")
            .attr("href", "javascript:")
            .text("+展开继承属性")
            .on('click', async () => {
                const attributes = note.getAttributes();
                const inheritedAttributes = attributes.filter(attr => attr.noteId !== this.noteId);

                if (inheritedAttributes.length === 0) {
                    $inheritedAttrs.text("没有继承的属性...");
                }
                else {
                    await this.renderAttributes(inheritedAttributes, $inheritedAttrs);
                }

                $inheritedAttrs.show();
                $showInheritedAttributes.hide();
                $hideInheritedAttributes.show();
            });

        const $hideInheritedAttributes = $("<a>")
            .attr("href", "javascript:")
            .text("-收起继承属性")
            .on('click', () => {
                $showInheritedAttributes.show();
                $hideInheritedAttributes.hide();
                $inheritedAttrs.empty().hide();
            });

        $attributesContainer.append($showInheritedAttributes, $inheritedAttrs, $hideInheritedAttributes);

        $inheritedAttrs.hide();
        $hideInheritedAttributes.hide();

        this.$body.empty().append($attributesContainer);
    }

    async renderAttributes(attributes, $container) {
        for (const attribute of attributes) {
            if (attribute.type === 'label') {
                $container.append(utils.formatLabel(attribute) + " ");
            } else if (attribute.type === 'relation') {
                if (attribute.value) {
                    $container.append('@' + attribute.name + "=");
                    $container.append(await linkService.createNoteLink(attribute.value));
                    $container.append(" ");
                } else {
                    ws.logError(`Relation ${attribute.attributeId} has empty target`);
                }
            } else if (attribute.type === 'label-definition' || attribute.type === 'relation-definition') {
                $container.append(attribute.name + " definition ");
            } else {
                ws.logError("Unknown attr type: " + attribute.type);
            }
        }
    }

    entitiesReloadedEvent({loadResults}) {
        if (loadResults.getAttributes().find(attr => attr.noteId === this.noteId)) {
            this.refresh();
        }
    }
}