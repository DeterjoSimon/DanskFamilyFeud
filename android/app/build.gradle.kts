plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "dk.familyfeud.collector"
    compileSdk = 35

    defaultConfig {
        applicationId = "dk.familyfeud.collector"
        minSdk = 29
        targetSdk = 35
        versionCode = 1
        versionName = "1.0"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
    buildFeatures {
        buildConfig = true
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.activity:activity-ktx:1.9.3")
    implementation("androidx.webkit:webkit:1.12.1")
}

/**
 * The UI is the web app in ../../app (the same files GitHub Pages serves).
 * They are copied into the APK's assets on every build, so there is a single source of truth.
 */
abstract class CopyWebApp : DefaultTask() {
    @get:InputDirectory
    @get:PathSensitive(PathSensitivity.RELATIVE)
    abstract val webDir: DirectoryProperty

    @get:OutputDirectory
    abstract val outputDir: DirectoryProperty

    @get:Inject
    abstract val fs: FileSystemOperations

    @TaskAction
    fun copy() {
        fs.sync {
            from(webDir) {
                // Browser-only files: the APK is offline by design and installs natively.
                exclude("sw.js", "manifest.webmanifest")
            }
            into(outputDir.dir("www"))
        }
    }
}

val copyWebApp = tasks.register<CopyWebApp>("copyWebApp") {
    webDir.set(rootDir.parentFile.resolve("app"))
    outputDir.set(layout.buildDirectory.dir("generated/webapp"))
}

androidComponents {
    onVariants { variant ->
        variant.sources.assets?.addGeneratedSourceDirectory(copyWebApp, CopyWebApp::outputDir)
    }
}
