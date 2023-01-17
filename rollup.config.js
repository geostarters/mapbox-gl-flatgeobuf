import {terser} from 'rollup-plugin-terser'
import resolve from 'rollup-plugin-node-resolve'
import commonjs from 'rollup-plugin-commonjs'

const output = (input, file, format, plugins) => ({
    input,
    output: {
        name: 'mapboxglFlatgeobuf',
        file,
        format
    },
    plugins
})

export default [
    output('./src/main.js', './dist/mapbox-gl-flatgeobuf.js', 'umd', [resolve({ browser: true}),commonjs()]),
    output('./src/main.js', './dist/mapbox-gl-flatgeobuf.min.js', 'umd', [resolve({ browser: true}),commonjs(), terser()]),
    output('./src/main.js', './dist/mapbox-gl-flatgeobuf.esm.js', 'esm', [resolve({ browser: true}),commonjs()])
]
