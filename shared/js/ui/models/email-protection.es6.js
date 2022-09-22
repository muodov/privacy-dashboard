const Parent = window.DDG.base.Model

/** @this {any} */
function EmailProtectionModel (attrs) {
    attrs = attrs || {}
    if (!('emailProtectionUserData' in attrs)) {
        throw new Error('`emailProtectionUserData` is required for EmailProtectionModel')
    }
    Parent.call(this, attrs)
    this._setup()
}

/**
 * @typedef {object} UserData
 * @property {string} cohort
 * @property {string} nextAlias
 * @property {string} token
 * @property {string} userName
 */

EmailProtectionModel.prototype = window.$.extend({},
    Parent.prototype,
    {
        modelName: 'emailProtection',
        /**
         * @type {UserData | null}
         */
        emailProtectionUserData: null,
        /**
         * A state enum the UI can use to decide what to render.
         *
         * 'unknown' - this means we don't have sufficient data to determine the current state
         * 'idle' - this means we are able to provide an alias, but nothing is currently happening
         * 'added' - this is a temporary state that is entered into following use of the alias.
         *
         * @type {"unknown" | "idle" | "added"}
         */
        state: 'unknown',

        /**
         * From the initial data, decide what the first state should be
         * @private
         */
        _setup () {
            if (this.emailProtectionUserData?.nextAlias) {
                this.state = 'idle'
            }
        },

        refreshAlias: function () {
            return this.fetch({ messageType: 'refreshAlias', options: {} }).then(resp => {
                // not using 'this.set()' here as there's no expected UI response to this.
                if (typeof resp.privateAddress === 'string') {
                    this.emailProtectionUserData.nextAlias = resp.privateAddress
                } else {
                    console.warn('response did not contain a private address', resp)
                    this.emailProtectionUserData.nextAlias = null
                }
            })
        }
    }
)

module.exports = EmailProtectionModel
