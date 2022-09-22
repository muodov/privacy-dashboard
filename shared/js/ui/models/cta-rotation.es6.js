const Parent = window.DDG.base.Model
const { ctas } = require('../templates/cta-rotation.es6')

const constants = {
    MODEL_NAME: 'ctaRotation',
    CTA_SCREENS: Object.keys(ctas)
}

/** @this {any} */
function CtaRotationModel (attrs) {
    attrs = attrs || {}
    Parent.call(this, attrs)
    this._setup()
}

CtaRotationModel.prototype = window.$.extend({},
    Parent.prototype,
    {
        modelName: constants.MODEL_NAME,
        /**
         * Which CTA screen is going to be shown next.
         * @type {string}
         */
        currentCta: constants.CTA_SCREENS[0],
        /**
         * We need to do this to prevent showing the
         * email CTA to existing signed-in users
         * @this {any}
         */
        _setup: function () {
            if (this.emailProtectionUserData?.nextAlias) {
                this.currentCta = 'spread'
            } else {
                this.setRandomCta()
            }
        },
        /**
         * If we decide all CTAs can be displayed, just choose a random one
         */
        setRandomCta: function () {
            const names = constants.CTA_SCREENS
            const random = Math.floor(Math.random() * names.length)
            this.currentCta = names[random]
        }
    }
)

module.exports.CtaRotationModel = CtaRotationModel
module.exports.constants = constants
