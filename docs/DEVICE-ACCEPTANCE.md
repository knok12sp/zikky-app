# Device acceptance checklist

Automated tests mock React Native and native audio. Use this checklist on a real
phone before calling a release device-verified. Record the device, OS version,
server software and build SHA with the results.

## Install and connect

- [ ] Fresh install opens on the login screen with no prefilled private address.
- [ ] A wrong password shows a clear error and keeps the form usable.
- [ ] A correct HTTPS address and credentials sign in.
- [ ] Up to four addresses are accepted; an unreachable first route falls over
      to the next.
- [ ] A plain-HTTP address works only when the build included its host in
      `ZIKKY_HTTP_HOSTS`.
- [ ] The app restores the saved session after a restart.

## Library and search

- [ ] Songs, albums, artists, playlists and favourites load from the server.
- [ ] Album and artist grouping matches the server.
- [ ] Long lists scroll smoothly and do not lose position unexpectedly.
- [ ] Search returns server results; clearing it restores the library.
- [ ] Loading, empty, no-result and server-error states are understandable.
- [ ] Missing artwork falls back cleanly.

## Playback

- [ ] Play, pause, previous and next work from the full player and mini-player.
- [ ] The mini-player stays in sync with Now Playing.
- [ ] Seeking updates the position and survives the next track transition.
- [ ] Shuffle preserves the current track; repeat off/all/one behave correctly.
- [ ] Continuous playback works through several tracks.
- [ ] Lock-screen metadata and artwork appear.
- [ ] Headset, Bluetooth and interruption behaviour is correct.
- [ ] Background audio survives locking the phone.
- [ ] A stopped or unreachable server produces a useful error and retry.
- [ ] Sleep timer and finish-current-song sleep stop playback as described.

## Queue and playlists

- [ ] Play next and Add to queue insert in the expected position.
- [ ] Reordering and removing tracks keep the current track playing.
- [ ] Clearing the queue stops playback cleanly.
- [ ] Creating a playlist, adding tracks, removing tracks and reordering persist
      after an app restart and appear on the server.
- [ ] Favourites update on the server and survive a refresh.
- [ ] Listen later bookmarks are local only and never download audio.

## Phone downloads

- [ ] Download to this phone is the only way a file is stored locally.
- [ ] Browsing and searching never create a download.
- [ ] Wi-Fi-only blocks a cellular download and explains why.
- [ ] Progress, pause, resume, cancel and retry behave correctly.
- [ ] A completed download plays in airplane mode after an app restart.
- [ ] Removing a phone copy deletes only the local file and keeps the queue.
- [ ] The server copy still exists after removing a phone download.
- [ ] Corrupt or interrupted files are rejected rather than played.

## Appearance and accessibility

- [ ] System, dark and light themes all render readable contrast.
- [ ] Large accessibility text does not clip titles or controls.
- [ ] Screen readers announce every control and the current playback state.
- [ ] Touch targets are comfortable with one hand.
- [ ] Reduced-motion settings do not break navigation.
- [ ] Safe areas and the home indicator are respected on both platforms.
- [ ] Android back gestures and iOS swipe-back behave correctly.

## Failure and recovery

- [ ] Airplane mode shows cached metadata and clear offline messaging.
- [ ] Reconnecting recovers without losing the queue.
- [ ] A changed server address does not create a second account scope.
- [ ] Signing out keeps phone downloads when requested.
- [ ] Removing account data clears credentials, cache and downloads.
