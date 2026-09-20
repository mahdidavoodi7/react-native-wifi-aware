package com.margelo.nitro.wifiaware.support

import com.margelo.nitro.wifiaware.BootstrappingMethod
import com.margelo.nitro.wifiaware.PairingRequest

/**
 * Routes pairing callbacks from discovery sessions to the pairing object.
 *
 * The platform delivers pairing events on the session that discovered the peer, but the pairing
 * API is a separate object. This is the seam between them, so a request raised on any active
 * session reaches whoever is listening.
 */
object PairingEvents {
  private val requestListeners = ListenerStore<PairingRequest>()
  private val bootstrappingListeners = ListenerStore<Pair<String, BootstrappingMethod>>()

  /** Registers interest in inbound pairing requests. Returns a handle that stops delivery. */
  fun onPairingRequest(listener: (PairingRequest) -> Unit) = requestListeners.add(listener)

  /** Registers interest in completed bootstrapping exchanges. */
  fun onBootstrapping(listener: (Pair<String, BootstrappingMethod>) -> Unit) =
    bootstrappingListeners.add(listener)

  /** Called by a discovery session when a peer asks to pair. */
  fun emitPairingRequest(request: PairingRequest) = requestListeners.emit(request)

  /** Called by a discovery session when a bootstrapping exchange completes. */
  fun emitBootstrapping(peerId: String, method: BootstrappingMethod) =
    bootstrappingListeners.emit(peerId to method)
}
