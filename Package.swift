// swift-tools-version:5.5
// The swift-tools-version declares the minimum version of Swift required to build this package.

import PackageDescription

let package = Package(
    name: "PrivacyDashboard",
    platforms: [
        .iOS("13.0"),
        .macOS("10.15")
    ],
    products: [
        .library(
            name: "PrivacyDashboard",
            targets: ["PrivacyDashboard"]),
    ],
    dependencies: [
        .package(url: "https://github.com/duckduckgo/BrowserServicesKit", .upToNextMajor(from: "25.0.0")),
        .package(url: "https://github.com/duckduckgo/TrackerRadarKit", .upToNextMajor(from: "1.0.4"))
    ],
    targets: [
        .target(
            name: "PrivacyDashboard",
            dependencies: ["BrowserServicesKit",
                           "TrackerRadarKit",
                           .target(name: "PrivacyDashboard-resources-for-ios", condition: .when(platforms: [.iOS])),
                           .target(name: "PrivacyDashboard-resources-for-macos", condition: .when(platforms: [.macOS]))
                          ],
            path: "swift-package/Sources"),
        
        .target(
            name: "PrivacyDashboard-resources-for-ios",
            path: "swift-package/Resources/ios",
            resources: [.copy("assets")]),
    
        .target(
            name: "PrivacyDashboard-resources-for-macos",
            path: "swift-package/Resources/macos",
            resources: [.copy("assets")]),
    
        .testTarget(
            name: "PrivacyDashboardTests",
            dependencies: ["PrivacyDashboard"],
            path: "swift-package/Tests"),
    ]
)
