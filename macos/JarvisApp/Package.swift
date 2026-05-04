// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "JarvisApp",
    platforms: [
        .macOS(.v13)
    ],
    products: [
        .executable(name: "JarvisApp", targets: ["JarvisApp"])
    ],
    dependencies: [],
    targets: [
        .executableTarget(
            name: "JarvisApp",
            dependencies: [],
            path: "Sources"
        )
    ]
)
