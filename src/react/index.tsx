/**
 * @dev @paylater/sdk/react — thin React wrapper around the vanilla SDK.
 *
 * Drop `<PayLaterWidget>` into any React tree and the SDK handles its own
 * lifecycle. The component's props mirror the vanilla `PayLaterOptions`,
 * with one extension: changes to `theme` and `on.*` callbacks are propagated
 * to the underlying widget via `instance.update()` instead of remounting.
 */

import type { CSSProperties, ForwardedRef, ReactElement, Ref } from "react";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

import { PayLater } from "../index";
import type {
  CloseEvent,
  ErrorEvent,
  PayLaterOptions,
  SuccessEvent,
  WidgetInstance,
} from "../types";

/**
 * @dev Props for `<PayLaterWidget>`.
 */
export interface PayLaterWidgetProps extends Omit<PayLaterOptions, "on"> {
  ref?: Ref<WidgetInstance>; // Imperative handle to the underlying WidgetInstance. Available after mount.
  style?: CSSProperties; // Optional style applied to the host `div` (the shadow root container).
  className?: string; // Optional className applied to the host `div`.
  onSuccess?: (event: SuccessEvent) => void; // Fires when the customer successfully signs.
  onError?: (event: ErrorEvent) => void; // Fires when an unrecoverable error stops the flow.
  onClose?: (event: CloseEvent) => void; // Fires when the widget is unmounted (`abandoned: true` if the customer left mid-flow).
  onReady?: () => void; // Fires once the widget is mounted and ready to interact.
  onPhaseChange?: (phase: "amount" | "delivery" | "sign" | "done") => void; // Fires whenever the customer changes phase.
}

/**
 * @dev Internal implementation of the PayLaterWidget. The exported `PayLaterWidget`
 * is a `forwardRef` wrapper around this component, which allows us to expose an
 * imperative handle to the underlying `WidgetInstance` while still using hooks
 * for lifecycle and state management.
 *
 * The component manages the mounting and unmounting of the PayLater widget, as well
 * as reactive updates to the theme and event handlers without remounting.
 */
function PayLaterWidgetImpl(
  props: PayLaterWidgetProps,
  ref: ForwardedRef<WidgetInstance>,
): ReactElement {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const instanceRef = useRef<WidgetInstance | null>(null);
  const handlersRef = useRef({
    onSuccess: props.onSuccess,
    onError: props.onError,
    onClose: props.onClose,
    onReady: props.onReady,
    onPhaseChange: props.onPhaseChange,
  });

  // Keep handler refs current without remounting the widget.
  useEffect(() => {
    handlersRef.current = {
      onSuccess: props.onSuccess,
      onError: props.onError,
      onClose: props.onClose,
      onReady: props.onReady,
      onPhaseChange: props.onPhaseChange,
    };
  }, [props.onSuccess, props.onError, props.onClose, props.onReady, props.onPhaseChange]);

  // Mount once — options other than `theme` and event handlers should not
  // remount, so we read the rest from the initial render and patch the
  // reactive ones via `update()` below.
  useEffect(() => {
    if (!hostRef.current) return;

    const initial: PayLaterOptions = {
      apiKey: props.apiKey,
      apiBaseUrl: props.apiBaseUrl,
      theme: props.theme,
      position: props.position,
      locale: props.locale,
      country: props.country,
      amount: props.amount,
      prefill: props.prefill,
      hide: props.hide,
      lock: props.lock,
      custody: props.custody,
      on: {
        success: (event) => handlersRef.current.onSuccess?.(event),
        error: (event) => handlersRef.current.onError?.(event),
        close: (event) => handlersRef.current.onClose?.(event),
        ready: () => handlersRef.current.onReady?.(),
        phaseChange: (phase) => handlersRef.current.onPhaseChange?.(phase),
      },
    };

    const instance = PayLater.init(initial).mount(hostRef.current);
    instanceRef.current = instance;

    return () => {
      instance.unmount();
      instanceRef.current = null;
    };
    // Mount only once. Reactive options are patched by the next effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reactive updates for theme — cheaper than remounting. Depend on
  // individual tokens rather than the object identity so callers can pass an
  // inline `theme={{ ... }}` literal without retriggering the effect.
  useEffect(() => {
    if (!instanceRef.current) return;

    instanceRef.current.update({ theme: props.theme });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    props.theme?.light?.primary,
    props.theme?.light?.accent,
    props.theme?.dark?.primary,
    props.theme?.dark?.accent,
    props.theme?.radius,
    props.theme?.mode,
    props.theme?.fontFamily,
  ]);

  // Propagate the rest of the reactive options (country, amount, prefill,
  // hide, lock, custody) so consumers can drive them from React state. The
  // underlying widget syncs these into its internal state on each update.
  useEffect(() => {
    if (!instanceRef.current) return;

    instanceRef.current.update({
      country: props.country,
      amount: props.amount,
      prefill: props.prefill,
      hide: props.hide,
      lock: props.lock,
      custody: props.custody,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    props.country,
    props.amount,
    props.prefill?.email,
    props.prefill?.walletAddress,
    props.prefill?.network,
    props.prefill?.fullName,
    props.hide,
    props.lock,
    props.custody,
  ]);

  // The factory only runs after mount commits, by which time `instanceRef.current`
  // is populated. Asserting non-null keeps the ref type ergonomic for consumers.
  useImperativeHandle(ref, () => instanceRef.current as WidgetInstance, []);

  return <div ref={hostRef} style={props.style} className={props.className} />;
}

export const PayLaterWidget = forwardRef<WidgetInstance, PayLaterWidgetProps>(PayLaterWidgetImpl);
PayLaterWidget.displayName = "PayLaterWidget";

export type {
  CloseEvent,
  ErrorEvent,
  PayLaterOptions,
  SuccessEvent,
  WidgetInstance,
} from "../types";
