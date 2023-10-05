import { useLayoutEffect } from 'preact/hooks'
import { MDCRipple } from '@material/ripple'

/**
 * @param {object} params
 * @param {any} params.ref
 */
export function useRipple(params) {
    const { ref } = params
    useLayoutEffect(() => {
        const $el = ref.current
        if (!$el) return
        $el.classList.add('material-design-ripple')
        const instance = MDCRipple.attachTo($el)
        instance.listen('click', function (e) {
            if (e.target instanceof HTMLElement) {
                e.target.closest?.('a')?.blur()
            }
        })
        return () => {
            // cleanup
            instance.destroy()
        }
    }, [])
}
