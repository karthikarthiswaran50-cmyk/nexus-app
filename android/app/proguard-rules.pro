-keepattributes *Annotation*
-keepclassmembers class * {
    @org.chromium.base.annotations.CalledByNative <methods>;
}
-dontwarn com.google.androidbrowserhelper.**
