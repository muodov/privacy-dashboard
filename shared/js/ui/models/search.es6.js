const browserUIWrapper = require('../../browser/communication.es6.js')
const Parent = window.DDG.base.Model

/** @this {any} */
function Search (attrs) {
    Parent.call(this, attrs)
}

Search.prototype = window.$.extend({},
    Parent.prototype,
    {

        modelName: 'search',

        doSearch: function (searchTerm) {
            this.searchText = searchTerm
            searchTerm = encodeURIComponent(searchTerm)
            browserUIWrapper.search(searchTerm)
        },

        openOptionsPage: function () {
            this.fetch({ messageType: 'getBrowser' }).then(browserName => {
                browserUIWrapper.openOptionsPage(browserName)
            }).catch(e => {
                console.error('openOptionsPage', e)
            })
        }
    }
)

module.exports = Search
