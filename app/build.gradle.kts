plugins {
    id("com.android.application")
}

android {
    namespace = "cn.ziwu.xueshu"
    compileSdk = 34

    defaultConfig {
        applicationId = "cn.ziwu.xueshu"
        minSdk = 24
        targetSdk = 34
        versionCode = 8
        versionName = "1.2.5"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            // 若仓库 Secrets 提供签名信息则签名，否则保持未签名（CI 产出 debug 包可直接安装）
            val ksPath = System.getenv("ZIWU_KEYSTORE")
            if (!ksPath.isNullOrBlank()) {
                signingConfig = signingConfigs.create("release") {
                    storeFile = file(ksPath)
                    storePassword = System.getenv("ZIWU_STORE_PASS")
                    keyAlias = System.getenv("ZIWU_KEY_ALIAS") ?: "ziwu"
                    keyPassword = System.getenv("ZIWU_KEY_PASS")
                }
            }
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    // 内容全部在 assets/，无需额外配置
}
