package com.margelo.nitro.wifiaware.support

import android.content.Context
import android.net.wifi.aware.AttachCallback
import android.net.wifi.aware.WifiAwareManager
import android.net.wifi.aware.WifiAwareSession
import android.os.Build
import android.os.Handler
import android.os.HandlerThread
import androidx.annotation.RequiresApi
import com.margelo.nitro.NitroModules
import com.margelo.nitro.wifiaware.WifiAwareErrorCode
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException
import kotlinx.coroutines.suspendCancellableCoroutine

/**
 * Owns the process-wide attachment to the Wi-Fi Aware subsystem.
 *
 * Attaching forms a cluster with nearby devices, which costs power, so a single session is shared
 * by every publish and subscribe rather than attaching per session.
 *
 * The two-argument `attach` overload is used deliberately: the `IdentityChangedListener` overload
 * additionally requires location permission and wakes the host periodically.
 */
@RequiresApi(Build.VERSION_CODES.O)
object AwareAttachment {
  private val handlerThread = HandlerThread("wifi-aware").apply { start() }

  /** Callbacks are delivered here, off the main thread. */
  val handler: Handler = Handler(handlerThread.looper)

  private var session: WifiAwareSession? = null
  private val lock = Any()

  /** The application context, or `null` before Nitro has been initialised. */
  val context: Context?
    get() = NitroModules.applicationContext?.applicationContext

  /** The system service, or `null` on devices without Wi-Fi Aware. */
  val manager: WifiAwareManager?
    get() = context?.getSystemService(Context.WIFI_AWARE_SERVICE) as? WifiAwareManager

  /** Whether the hardware declares Wi-Fi Aware support. */
  val hasFeature: Boolean
    get() =
      context?.packageManager?.hasSystemFeature(android.content.pm.PackageManager.FEATURE_WIFI_AWARE)
        ?: false

  /** Whether Wi-Fi Aware can be used right now — Wi-Fi on, radio not held by another feature. */
  val isAvailable: Boolean
    get() = hasFeature && (manager?.isAvailable ?: false)

  /**
   * Returns the shared session, attaching on first use.
   *
   * @throws Throwable tagged `unsupported` on devices without the feature, `unavailable` when the
   *   radio is busy or Wi-Fi is off, and `attach-failed` if the subsystem refuses to attach.
   */
  suspend fun session(): WifiAwareSession {
    synchronized(lock) { session }?.let { return it }

    if (!hasFeature) {
      throw WifiAwareFailure.error(
        WifiAwareErrorCode.UNSUPPORTED,
        "This device does not support Wi-Fi Aware.",
      )
    }

    val manager =
      manager
        ?: throw WifiAwareFailure.error(
          WifiAwareErrorCode.UNSUPPORTED,
          "The Wi-Fi Aware system service is not available on this device.",
        )

    if (!manager.isAvailable) {
      throw WifiAwareFailure.error(
        WifiAwareErrorCode.UNAVAILABLE,
        "Wi-Fi Aware is not available right now. It is disabled while Wi-Fi is off, and while " +
          "Wi-Fi Direct, a hotspot, or tethering is using the radio.",
      )
    }

    val attached =
      suspendCancellableCoroutine<WifiAwareSession> { continuation ->
        try {
          manager.attach(
            object : AttachCallback() {
              override fun onAttached(newSession: WifiAwareSession) {
                if (continuation.isActive) continuation.resume(newSession)
              }

              override fun onAttachFailed() {
                if (continuation.isActive) {
                  continuation.resumeWithException(
                    WifiAwareFailure.error(
                      WifiAwareErrorCode.ATTACH_FAILED,
                      "Attaching to the Wi-Fi Aware subsystem failed.",
                    )
                  )
                }
              }
            },
            handler,
          )
        } catch (securityError: SecurityException) {
          if (continuation.isActive) {
            continuation.resumeWithException(
              WifiAwareFailure.error(
                WifiAwareErrorCode.PERMISSION_DENIED,
                "Wi-Fi Aware needs the NEARBY_WIFI_DEVICES permission (or ACCESS_FINE_LOCATION " +
                  "below API 33). Request it before starting a session.",
              )
            )
          }
        }
      }

    synchronized(lock) {
      val existing = session
      if (existing != null) {
        // Another caller attached while this one was suspended; keep one session and drop ours.
        attached.close()
        return existing
      }
      session = attached
    }
    return attached
  }

  /** Closes the shared session. Used when the last consumer goes away. */
  fun closeSession() {
    val existing = synchronized(lock) { session.also { session = null } }
    existing?.close()
  }
}
