/**
 * @module macOS integration
 *
 * @description
 *
 * **Incoming data**
 *
 * On macOS, all data for the dashboard is delivered via methods that have been
 * attached to the global `window` object. Please see the aboutLink below under the heading 'macOS -> JavaScript Interface' for examples.
 *
 * **Outgoing messages**
 *
 * The dashboard communicates with the macOS application by calling message handlers that
 * are added to `window.webkit.messageHandlers.*`. Please see the items below under the heading `"Webkit Message Handlers"`

 * @category integrations
 */
import invariant from 'tiny-invariant'
import {
    cookiePromptManagementStatusSchema,
    localeSettingsSchema,
    protectionsStatusSchema,
    requestDataSchema,
    toggleReportScreenSchema,
} from '../../../schema/__generated__/schema.parsers.mjs'
import { isIOS } from '../ui/environment-check'
import { setupGlobalOpenerListener } from '../ui/views/utils/utils'
import {
    CloseMessage,
    FetchToggleReportOptions,
    getContentHeight,
    OpenSettingsMessages,
    RejectToggleBreakageReport,
    SeeWhatIsSent,
    SendToggleBreakageReport,
    SetListsMessage,
    setupColorScheme,
    setupMutationObserver,
    SubmitBrokenSiteReportMessage,
    UpdatePermissionMessage,
} from './common.js'
import { createTabData } from './utils/request-details.mjs'

let channel = null

/**
 * @category Internal API
 * @param backgroundModel
 */
const backgroundMessage = (backgroundModel) => {
    channel = backgroundModel
}

const getBackgroundTabDataPromises = []
let trackerBlockingData
let permissionsData
let certificateData
let upgradedHttps
/** @type {import("./utils/protections.mjs").Protections | undefined} */
let protections
let isPendingUpdates
let parentEntity
const cookiePromptManagementStatus = {}

/** @type {string | undefined} */
let locale

const combineSources = () => ({
    tab: Object.assign(
        {},
        trackerBlockingData || {},
        {
            isPendingUpdates,
            parentEntity,
            cookiePromptManagementStatus,
            platformLimitations: true,
            locale,
        },
        permissionsData ? { permissions: permissionsData } : {},
        certificateData ? { certificate: certificateData } : {}
    ),
})

const resolveInitialRender = function () {
    const isUpgradedHttpsSet = typeof upgradedHttps === 'boolean'
    const isIsProtectedSet = typeof protections !== 'undefined'
    const isTrackerBlockingDataSet = typeof trackerBlockingData === 'object'
    const isLocaleSet = typeof locale === 'string'
    if (!isLocaleSet || !isUpgradedHttpsSet || !isIsProtectedSet || !isTrackerBlockingDataSet) {
        return
    }
    getBackgroundTabDataPromises.forEach((resolve) => resolve(combineSources()))
    channel?.send('updateTabData')
}

// Integration APIs
// -----------------------------------------------------------------------------
/**
 * Call this method when there is updated request information.
 *
 * Note: this expects each call to provide the full data set each time, **not** any kind of delta
 *
 * @group macOS -> JavaScript Interface
 * @example
 *
 * ```javascript
 * window.onChangeTrackerBlockingData("https://example.com", rawRequestData)
 * ```
 *
 * @param {string} tabUrl
 * @param {import('../../../schema/__generated__/schema.types').RequestData} rawRequestData
 *
 * Please see [cnn.json](media://request-data-cnn.json) or [google.json](media://request-data-google.json) for examples of this type
 */
export function onChangeRequestData(tabUrl, rawRequestData) {
    const requestData = requestDataSchema.safeParse(rawRequestData)
    if (!protections) throw new Error('protections status not set')
    if (!requestData.success) {
        console.error('could not parse incoming request data from `onChangeRequestData`')
        console.log(requestData.error)
        return
    }
    trackerBlockingData = createTabData(tabUrl, upgradedHttps, protections, requestData.data)
    resolveInitialRender()
}

/**
 * {@inheritDoc common.onChangeProtectionStatus}
 * @type {import("./common.js").onChangeProtectionStatus}
 * @group macOS -> JavaScript Interface
 *
 * @example
 *
 * On the swift side, evaluate JavaScript calling the correct method on `window`, something like this...
 *
 * ```swift
 * // swift
 * evaluate(js: "window.onChangeTrackerBlockingData(\(safeTabUrl), \(trackerBlockingDataJson))", in: webView)
 * ```
 *
 * @param {import('../../../schema/__generated__/schema.types').ProtectionsStatus} protectionsStatus
 */
export function onChangeProtectionStatus(protectionsStatus) {
    const parsed = protectionsStatusSchema.safeParse(protectionsStatus)
    if (!parsed.success) {
        console.error('could not parse incoming protection status from onChangeProtectionStatus')
        console.error(parsed.error)
        return
    }
    protections = parsed.data
    resolveInitialRender()
}

/**
 * {@inheritDoc common.onChangeLocale}
 * @type {import("./common.js").onChangeLocale}
 * @group macOS -> JavaScript Interface
 * @example
 *
 * ```swift
 * // swift
 * evaluate(js: "window.onChangeLocale(\(localSettingsJsonString))", in: webView)
 * ```
 */
export function onChangeLocale(payload) {
    const parsed = localeSettingsSchema.safeParse(payload)
    if (!parsed.success) {
        console.error('could not parse incoming data from onChangeLocale')
        console.error(parsed.error)
        return
    }
    locale = parsed.data.locale
    channel?.send('updateTabData')
}

/**
 * {@inheritDoc common.onChangeConsentManaged}
 * @type {import("./common.js").onChangeConsentManaged}
 * @group macOS -> JavaScript Interface
 * @example On macOS and iOS, it might look something like this:
 *
 * ```swift
 * // swift
 * evaluate(js: "window.onChangeConsentManaged(\(cookiePromptManagementStatus))", in: webView)
 * ```
 */
export function onChangeConsentManaged(payload) {
    const parsed = cookiePromptManagementStatusSchema.safeParse(payload)
    if (!parsed.success) {
        console.error('could not parse incoming data from onChangeConsentManaged')
        console.error(parsed.error)
        return
    }
    Object.assign(cookiePromptManagementStatus, parsed.data)
    channel?.send('updateTabData')
}

// -----------------------------------------------------------------------------

/**
 * This message will be sent when the toggle is pressed on, or off via:
 *  - The primary screen
 *  - The breakage form
 *
 * @param {import('../../../schema/__generated__/schema.types').SetProtectionParams} params
 * @category Webkit Message Handlers
 * @example
 *
 * This message handler is the equivalent of calling the following JavaScript.
 *
 * ```js
 * window.webkit.messageHandlers.privacyDashboardSetProtection.postMessage({
 *    isProtected: true,
 *    eventOrigin: { screen: "primaryScreen" }
 * })
 * ```
 */
export function privacyDashboardSetProtection(params) {
    invariant(
        window.webkit?.messageHandlers?.privacyDashboardSetProtection,
        'webkit.messageHandlers.privacyDashboardSetProtection required'
    )
    window.webkit.messageHandlers.privacyDashboardSetProtection.postMessage(params)
}

/**
 * {@inheritDoc common.setPermission}
 * @type {import("./common.js").setPermission}
 * @category Webkit Message Handlers
 * @example
 *
 * This message handler is the equivalent of calling the following JavaScript.
 *
 * ```js
 * window.webkit.messageHandlers.privacyDashboardSetPermission.postMessage({
 *    permission: "camera",
 *    value: "grant"
 * })
 * ```
 */
export function privacyDashboardSetPermission(params) {
    invariant(window.webkit?.messageHandlers, 'webkit.messageHandlers required')
    window.webkit.messageHandlers.privacyDashboardSetPermission.postMessage(params)
}

/**
 * @category Webkit Message Handler
 * @example
 *
 * When the Dashboard loads, it will call this message handler...
 *
 * ```js
 * window.webkit.messageHandlers.privacyDashboardGetToggleReportOptions.postMessage({})
 * ```
 *
 * ... then, to reply with the correct data, call evaluate on the following window method:
 *
 * The JSON object should match {@link "Generated Schema Definitions".ToggleReportScreen}
 *
 * ```js
 * window.onGetToggleReportOptionsResponse({ "data": [...] })
 * ```
 * <br>
 * <details>
 *   <summary>Sample JSON 📝</summary>
 *
 *   ```json
 *   [[include:toggle-report-screen.json]]```
 * </details>
 *
 * @returns {Promise<import('../../../schema/__generated__/schema.types').ToggleReportScreen>}
 */
export function privacyDashboardGetToggleReportOptions() {
    return new Promise((resolve) => {
        invariant(window.webkit?.messageHandlers, 'webkit.messageHandlers required')
        invariant(window.webkit.messageHandlers.privacyDashboardGetToggleReportOptions, 'privacyDashboardGetToggleReportOptions required')
        window.webkit.messageHandlers.privacyDashboardGetToggleReportOptions.postMessage({})
        window.onGetToggleReportOptionsResponse = (data) => {
            resolve(data)
            Reflect.deleteProperty(window, 'onGetToggleReportOptionsResponse')
        }
    })
}

/**
 * {@inheritDoc common.sendToggleReport}
 * @type {import("./common.js").sendToggleReport}
 * @category Webkit Message Handlers
 * @example
 *
 * This message handler is the equivalent of calling the following JavaScript.
 *
 * ```js
 * window.webkit.messageHandlers.privacyDashboardSendToggleReport.postMessage({})
 * ```
 */
export function privacyDashboardSendToggleReport() {
    invariant(window.webkit?.messageHandlers, 'webkit.messageHandlers required')
    invariant(window.webkit.messageHandlers.privacyDashboardSendToggleReport, 'privacyDashboardSendToggleReport required')
    return window.webkit.messageHandlers.privacyDashboardSendToggleReport.postMessage({})
}

/**
 * {@inheritDoc common.rejectToggleReport}
 * @type {import("./common.js").rejectToggleReport}
 * @category Webkit Message Handlers
 * @example
 *
 * This message handler is the equivalent of calling the following JavaScript.
 *
 * ```js
 * window.webkit.messageHandlers.privacyDashboardRejectToggleReport.postMessage({})
 * ```
 */
export function privacyDashboardRejectToggleReport() {
    invariant(window.webkit?.messageHandlers, 'webkit.messageHandlers required')
    invariant(window.webkit.messageHandlers.privacyDashboardRejectToggleReport, 'privacyDashboardRejectToggleReport required')
    return window.webkit.messageHandlers.privacyDashboardRejectToggleReport.postMessage({})
}

/**
 * This is sent when the user has chosen to show the information that will be used in the toggle report
 *
 * @category Webkit Message Handlers
 * @example
 *
 * This message handler is the equivalent of calling the following JavaScript.
 *
 * ```js
 * window.webkit.messageHandlers.privacyDashboardSeeWhatIsSent.postMessage({})
 * ```
 */
export function privacyDashboardSeeWhatIsSent() {
    invariant(window.webkit?.messageHandlers, 'webkit.messageHandlers required')
    invariant(window.webkit.messageHandlers.privacyDashboardSeeWhatIsSent, 'privacyDashboardSeeWhatIsSent required')
    return window.webkit.messageHandlers.privacyDashboardSeeWhatIsSent.postMessage({})
}

/**
 * Close the Dashboard.
 * @category Webkit Message Handlers
 * @param {import('../../../schema/__generated__/schema.types').CloseMessageParams} args
 * @example
 *
 * ```js
 * window.webkit.messageHandlers.privacyDashboardClose.postMessage(args)
 * ```
 * ### Sample JSON 📝
 * ```json
 * [[include:webkit-close.json]]```
 *
 */
export function privacyDashboardClose(args) {
    invariant(window.webkit?.messageHandlers, 'webkit.messageHandlers required')
    window.webkit.messageHandlers.privacyDashboardClose.postMessage(args)
}

/**
 * @category Internal API
 * @type {import("./common.js").fetcher}
 */
async function fetch(message) {
    if (message instanceof CloseMessage) {
        privacyDashboardClose({ eventOrigin: message.eventOrigin })
        return
    }

    if (message instanceof SubmitBrokenSiteReportMessage) {
        privacyDashboardSubmitBrokenSiteReport({
            category: message.category,
            description: message.description,
        })
        return
    }

    if (message instanceof SetListsMessage) {
        for (const listItem of message.lists) {
            const { list, value } = listItem
            if (list !== 'allowlisted') {
                if (!window.__playwright) console.warn('only `allowlisted` is currently supported on macos')
                continue
            }
            // `allowlisted: true` means the user disabled protections.
            // so `isProtected` is the opposite of `allowlisted`.
            const isProtected = value === false
            privacyDashboardSetProtection({ eventOrigin: message.eventOrigin, isProtected })
        }
        return
    }
    if (message instanceof OpenSettingsMessages) {
        privacyDashboardOpenSettings({
            target: message.target,
        })
        return
    }

    if (message instanceof UpdatePermissionMessage) {
        privacyDashboardSetPermission({
            permission: message.id,
            value: message.value,
        })
    }

    if (message instanceof FetchToggleReportOptions) {
        const data = await privacyDashboardGetToggleReportOptions()
        const parsed = toggleReportScreenSchema.parse(data)
        return parsed
    }

    if (message instanceof SendToggleBreakageReport) {
        return privacyDashboardSendToggleReport()
    }

    if (message instanceof RejectToggleBreakageReport) {
        return privacyDashboardRejectToggleReport()
    }

    if (message instanceof SeeWhatIsSent) {
        return privacyDashboardSeeWhatIsSent()
    }
}

/**
 * @category Internal API
 * @returns {Promise<unknown>}
 */
const getBackgroundTabData = () => {
    return new Promise((resolve) => {
        if (trackerBlockingData) {
            resolve(combineSources())
            return
        }

        getBackgroundTabDataPromises.push(resolve)
    })
}

/**
 * {@inheritDoc common.openInNewTab}
 * @type {import("./common.js").openInNewTab}
 * @category Webkit Message Handlers
 */
export function privacyDashboardOpenUrlInNewTab(args) {
    invariant(window.webkit?.messageHandlers, 'webkit.messageHandlers required')
    window.webkit.messageHandlers.privacyDashboardOpenUrlInNewTab.postMessage({
        url: args.url,
    })
}

/**
 * {@inheritDoc common.openSettings}
 * @type {import("./common.js").openSettings}
 * @category Webkit Message Handlers
 */
export function privacyDashboardOpenSettings(args) {
    invariant(window.webkit?.messageHandlers, 'webkit.messageHandlers required')
    window.webkit.messageHandlers.privacyDashboardOpenSettings.postMessage({
        target: args.target,
    })
}

/**
 * {@inheritDoc common.submitBrokenSiteReport}
 * @type {import("./common.js").submitBrokenSiteReport}
 * @category Webkit Message Handlers
 */
export function privacyDashboardSubmitBrokenSiteReport(report) {
    invariant(window.webkit?.messageHandlers, 'webkit.messageHandlers required')
    window.webkit.messageHandlers.privacyDashboardSubmitBrokenSiteReport.postMessage({
        category: report.category,
        description: report.description,
    })
}

/**
 * {@inheritDoc common.setSize}
 * @type {import("./common.js").setSize}
 * @category Webkit Message Handlers
 */
export function privacyDashboardSetSize(payload) {
    if (!isIOS()) {
        invariant(window.webkit?.messageHandlers, 'webkit.messageHandlers required')
        window.webkit.messageHandlers.privacyDashboardSetSize.postMessage(payload)
    }
}

/**
 * These side-effects are used on both ios/macos
 */
export function setupShared() {
    window.onChangeRequestData = onChangeRequestData
    window.onChangeAllowedPermissions = function (data) {
        permissionsData = data
        channel?.send('updateTabData')
    }
    window.onChangeUpgradedHttps = function (data) {
        upgradedHttps = data
        if (trackerBlockingData) trackerBlockingData.upgradedHttps = upgradedHttps
        resolveInitialRender()
    }
    window.onChangeProtectionStatus = onChangeProtectionStatus
    window.onChangeLocale = onChangeLocale
    window.onChangeCertificateData = function (data) {
        certificateData = data.secCertificateViewModels
        channel?.send('updateTabData')
    }
    window.onIsPendingUpdates = function (data) {
        isPendingUpdates = data
        channel?.send('updateTabData')
    }
    window.onChangeParentEntity = function (data) {
        parentEntity = data
        channel?.send('updateTabData')
    }
    window.onChangeConsentManaged = onChangeConsentManaged
    setupGlobalOpenerListener((href) => {
        privacyDashboardOpenUrlInNewTab({
            url: href,
        })
    })
}

/**
 * macOS specific setup
 */
export function setup() {
    setupColorScheme()
    setupShared()
    setupMutationObserver((height) => {
        privacyDashboardSetSize({ height })
    })
}

/**
 * Called when the DOM has been rendered for the first time. This is
 * helpful on platforms that need to update their window size immediately
 *
 * @type {NonNullable<import('./communication.js').Communication['firstRenderComplete']>}
 * @category Internal API
 */
function firstRenderComplete() {
    const height = getContentHeight()
    if (typeof height === 'number') {
        privacyDashboardSetSize({ height })
    }
}

export { fetch, backgroundMessage, getBackgroundTabData, firstRenderComplete }
