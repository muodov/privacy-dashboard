/**
 * @param {import('@playwright/test').Page} page
 * @param {import('../schema/__generated__/schema.types').RequestData} requestData
 * @param {Partial<import('../schema/__generated__/schema.types').Tab>} tab
 */
export async function withExtensionRequests (page, requestData, tab = {}) {
    const messages = {
        submitBrokenSiteReport: {},
        /** @type {import('../schema/__generated__/schema.types').ExtensionGetPrivacyDashboardData} */
        getPrivacyDashboardData: {
            tab: {
                id: 1533,
                url: 'https://example.com',
                upgradedHttps: false,
                protections: {
                    unprotectedTemporary: false,
                    enabledFeatures: ['contentBlocking'],
                    denylisted: false,
                    allowlisted: false
                },
                ...tab
            },
            requestData: requestData
        },
        setList: {}
    }
    await page.addInitScript((messages) => {
        try {
            const listeners = []
            if (!window.chrome) {
                // @ts-ignore
                window.chrome = {}
            }
            window.__playwright = {
                messages: messages,
                mocks: {
                    outgoing: [],
                    incoming: []
                },
                calls: []
            }

            // override some methods on window.chrome.tabs that the extension might call
            window.chrome.tabs = {
                ...window.chrome.tabs,
                reload: async function (id) {
                    window.__playwright.calls.push(['reload', id])
                },

                // @ts-ignore
                create: async (arg) => {
                    window.__playwright.calls.push(['create', arg])
                }
            }

            // override some methods on window.chrome.extension that the extension might call
            window.chrome.extension = {
                ...window.chrome.extension,
                // @ts-ignore
                getViews: function (arg) {
                    window.__playwright.calls.push(['getViews', arg])
                    return [
                        {
                            close: (arg) => {
                                window.__playwright.calls.push(['close', arg])
                            }
                        }
                    ]
                }
            }

            // override some methods on window.chrome.runtime to fake the incoming/outgoing messages
            window.chrome.runtime = {
                async sendMessage (message, cb) {
                    function send (fn, timeout = 100) {
                        setTimeout(() => {
                            fn()
                        }, timeout)
                    }

                    // does the incoming message match one that's been mocked here?
                    const matchingMessage = window.__playwright.messages[message.messageType]
                    if (matchingMessage) {
                        window.__playwright.mocks.outgoing.push(message)
                        console.log(`addInitScript.sendMessage -> ${JSON.stringify(message)}`)
                        send(() => cb(matchingMessage), 200)
                    } else {
                        console.log(`❌ [(mocks): window.chrome.runtime] Missing support for ${JSON.stringify(message)}`)
                    }
                },
                // @ts-ignore
                onMessage: {
                    addListener (listener) {
                        listeners.push(listener)
                    }
                }
            }
        } catch (e) {
            console.error('❌couldn\'t set up mocks')
            console.error(e)
        }
    }, messages)

    return {
        /**
         * @param {{names: string[]}} [opts]
         * @returns {Promise<any[]>}
         */
        async outgoing (opts = { names: [] }) {
            const result = await page.evaluate(() => window.__playwright.mocks.outgoing)
            /** @type {any[]} */
            if (opts.names.length === 0) return result
            return result.filter(item => opts.names.includes(item.messageType))
        },
        async calls () {
            return page.evaluate(() => window.__playwright.calls)
        }
    }
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {import('../schema/__generated__/schema.types').RequestData} requestData
 * @param {Partial<import('../schema/__generated__/schema.types').Tab>} tab
 */
export async function withWindowsRequests (page, requestData, tab = {}) {
    const messages = {
        /** @type {import('../schema/__generated__/schema.types').WindowsViewModel} */
        windowsViewModel: {
            protections: {
                unprotectedTemporary: false,
                enabledFeatures: ['contentBlocking'],
                denylisted: false,
                allowlisted: false
            },
            rawRequestData: requestData,
            tabUrl: 'https://example.com',
            upgradedHttps: false,
            parentEntity: undefined,
            permissions: undefined,
            certificates: []
        }
    }
    await page.addInitScript((messages) => {
        try {
            if (!window.chrome) {
                // @ts-ignore
                window.chrome = {}
            }
            window.__playwright = {
                listeners: [],
                messages: messages,
                mocks: {
                    outgoing: [],
                    incoming: []
                },
                calls: []
            }
            // override some methods on window.chrome.runtime to fake the incoming/outgoing messages
            window.chrome.webview = {
                // @ts-ignore
                addEventListener: (messageName, listener) => {
                    window.__playwright.listeners?.push(listener)
                },
                postMessage (arg) {
                    window.__playwright.mocks.outgoing.push(arg)
                }
            }
        } catch (e) {
            console.error('❌couldn\'t set up mocks')
            console.error(e)
        }
    }, messages)

    return {
        async deliverInitial () {
            await page.evaluate((messages) => {
                for (const listener of window.__playwright.listeners || []) {
                    listener({ data: messages.windowsViewModel })
                }
            }, messages)
        },
        /**
         * @param {{names: string[]}} [opts]
         * @returns {Promise<any[]>}
         */
        async outgoing (opts = { names: [] }) {
            const result = await page.evaluate(() => window.__playwright.mocks.outgoing)
            /** @type {any[]} */
            if (opts.names.length === 0) return result
            return result.filter(item => opts.names.includes(item.Name))
        }
    }
}

/**
 * @param {import('@playwright/test').Page} page
 */
export function forwardConsole (page) {
    page.on('console', (msg, other) => {
        const replaced = msg.text()
            .replace(/http:\/\/localhost:3210/g, './build/browser')
        console.log('->', msg.type(), replaced)
    })
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {import('../schema/__generated__/schema.types').RequestData} requestData
 * @param {Partial<import('../schema/__generated__/schema.types').Tab>} tab
 */
export async function withAndroidRequests (page, requestData, tab = {}) {
    const messages = {
        submitBrokenSiteReport: {},
        /** @type {import('../schema/__generated__/schema.types').ExtensionGetPrivacyDashboardData} */
        getPrivacyDashboardData: {
            tab: {
                id: 1533,
                url: 'https://example.com',
                upgradedHttps: false,
                protections: {
                    unprotectedTemporary: false,
                    enabledFeatures: ['contentBlocking'],
                    denylisted: false,
                    allowlisted: false
                },
                ...tab
            },
            requestData: requestData
        },
        setList: {}
    }
    await page.waitForFunction(() => typeof window.onChangeRequestData === 'function')
    await page.evaluate((messages) => {
        try {
            window.__playwright = {
                messages: messages,
                mocks: {
                    outgoing: [],
                    incoming: []
                },
                calls: []
            }
            // @ts-ignore
            window.PrivacyDashboard = {
                showBreakageForm (arg) {
                    window.__playwright.mocks.outgoing.push(['showBreakageForm', arg])
                },
                openInNewTab (arg) {
                    window.__playwright.mocks.outgoing.push(['openInNewTab', arg])
                }
            }
            window.onChangeUpgradedHttps(false)
            window.onChangeProtectionStatus({
                unprotectedTemporary: false,
                enabledFeatures: ['contentBlocking'],
                allowlisted: false,
                denylisted: false
            })
            window.onChangeRequestData(messages.getPrivacyDashboardData.tab.url, messages.getPrivacyDashboardData.requestData)
        } catch (e) {
            console.error('❌couldn\'t set up mocks')
            console.error(e)
        }
    }, messages)

    return {
        /**
         * @param {{names: string[]}} [opts]
         * @returns {Promise<any[]>}
         */
        async outgoing (opts = { names: [] }) {
            const result = await page.evaluate(() => window.__playwright.mocks.outgoing)
            return result
        }
    }
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {import('../schema/__generated__/schema.types').RequestData} requestData
 * @param {Partial<import('../schema/__generated__/schema.types').Tab>} tab
 */
export async function withWebkitRequests (page, requestData, tab = {}) {
    const messages = {
        submitBrokenSiteReport: {},
        /** @type {import('../schema/__generated__/schema.types').ExtensionGetPrivacyDashboardData} */
        getPrivacyDashboardData: {
            tab: {
                id: 1533,
                url: 'https://example.com',
                upgradedHttps: false,
                protections: {
                    unprotectedTemporary: false,
                    enabledFeatures: ['contentBlocking'],
                    denylisted: false,
                    allowlisted: false
                },
                ...tab
            },
            requestData: requestData
        },
        setList: {}
    }
    await page.waitForFunction(() => typeof window.onChangeRequestData === 'function')
    await page.evaluate((messages) => {
        try {
            window.__playwright = {
                messages: messages,
                mocks: {
                    outgoing: [],
                    incoming: []
                },
                calls: []
            }
            window.webkit = {
                messageHandlers: {
                    privacyDashboardShowReportBrokenSite: {
                        postMessage: (arg) => {
                            window.__playwright.mocks.outgoing.push(['privacyDashboardShowReportBrokenSite', arg])
                        }
                    },
                    privacyDashboardOpenUrlInNewTab: {
                        postMessage: (arg) => {
                            window.__playwright.mocks.outgoing.push(['privacyDashboardOpenUrlInNewTab', arg])
                        }
                    },
                    privacyDashboardSubmitBrokenSiteReport: {
                        postMessage: (arg) => {
                            window.__playwright.mocks.outgoing.push(['privacyDashboardSubmitBrokenSiteReport', arg])
                        }
                    }
                }
            }
            window.onChangeUpgradedHttps(false)
            window.onChangeProtectionStatus({
                unprotectedTemporary: false,
                enabledFeatures: ['contentBlocking'],
                allowlisted: false,
                denylisted: false
            })
            window.onChangeRequestData(messages.getPrivacyDashboardData.tab.url, messages.getPrivacyDashboardData.requestData)
        } catch (e) {
            console.error('❌couldn\'t set up mocks')
            console.error(e)
        }
    }, messages)

    return {
        /**
         * @param {{names: string[]}} [opts]
         * @returns {Promise<any[]>}
         */
        async outgoing (opts = { names: [] }) {
            const result = await page.evaluate(() => window.__playwright.mocks.outgoing)
            return result
        }
    }
}
