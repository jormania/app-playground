// CSS Modules default-export a map of class name → generated identifier.
declare module '*.module.css' {
  const classes: { readonly [key: string]: string }
  export default classes
}
