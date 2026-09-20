package com.margelo.nitro.wifiaware.support

import android.net.wifi.aware.AwarePairingConfig
import android.net.wifi.aware.DiscoverySession
import android.net.wifi.aware.PeerHandle
import java.util.concurrent.ConcurrentHashMap

/**
 * Maps the peer identifiers handed to JS back to the session and handle that found them.
 *
 * Pairing is driven through the discovery session that discovered a peer, but the pairing API is a
 * separate object from the sessions. This registry is the join between them, so a caller can pair
 * with a peer using only the identifier it received from `addOnPeerFoundListener`.
 *
 * Entries are session-scoped: they are dropped when the peer is lost or the session stops, matching
 * the documented lifetime of a `DiscoveredPeer.id`.
 */
object PeerRegistry {
  /**
   * A discovered peer, the session that can act on it, and what it advertised it can do.
   *
   * [pairingConfig] is absent for peers discovered on platforms or API levels that do not report
   * one, and for peers that advertised no pairing support.
   */
  data class Entry(
    val session: DiscoverySession,
    val handle: PeerHandle,
    val pairingConfig: AwarePairingConfig? = null,
  )

  private val entries = ConcurrentHashMap<String, Entry>()

  /** Records a peer discovered by [session]. */
  fun register(
    peerId: String,
    session: DiscoverySession,
    handle: PeerHandle,
    pairingConfig: AwarePairingConfig? = null,
  ) {
    entries[peerId] = Entry(session, handle, pairingConfig)
  }

  /** Looks up a peer, or `null` if it is no longer visible. */
  fun find(peerId: String): Entry? = entries[peerId]

  /** Forgets a single peer, once it has been lost. */
  fun remove(peerId: String) {
    entries.remove(peerId)
  }

  /** Forgets every peer belonging to a session that has stopped. */
  fun removeAll(session: DiscoverySession) {
    entries.entries.removeAll { it.value.session === session }
  }
}
