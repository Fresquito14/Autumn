import { readFileSync, writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Read theme colors JSON
const themeColorsPath = join(__dirname, '../src/config/theme-colors.json')
const themeColorsData = JSON.parse(readFileSync(themeColorsPath, 'utf-8'))
const themeColors = themeColorsData.colors

// Read current CSS
const cssPath = join(__dirname, '../src/index.css')
const css = readFileSync(cssPath, 'utf-8')

// Extract color values
const criticalLight = themeColors.critical.light.hsl
const criticalDark = themeColors.critical.dark.hsl
const progressLight = themeColors.progress.light.hsl
const progressDark = themeColors.progress.dark.hsl
const accentLight = themeColors.accent.light.hsl
const accentDark = themeColors.accent.dark.hsl

console.log('📝 Updating theme colors in index.css...')
console.log(`  Critical Light: ${criticalLight}`)
console.log(`  Critical Dark: ${criticalDark}`)
console.log(`  Progress Light: ${progressLight}`)
console.log(`  Progress Dark: ${progressDark}`)
console.log(`  Accent Light: ${accentLight}`)
console.log(`  Accent Dark: ${accentDark}`)

// Update CSS with new values
let updatedCss = css

// Update light mode colors
updatedCss = updatedCss.replace(
  /--autumn-critical:\s*[\d\s%]+;/,
  `--autumn-critical: ${criticalLight};`
)
updatedCss = updatedCss.replace(
  /--autumn-progress:\s*[\d\s%]+;/,
  `--autumn-progress: ${progressLight};`
)

// Update accent in light mode (look for the first occurrence after :root)
const rootSection = updatedCss.indexOf(':root {')
const darkSection = updatedCss.indexOf('.dark {')
const lightAccentPattern = /--accent:\s*[\d\s%]+;/
const firstAccentMatch = updatedCss.substring(rootSection, darkSection).match(lightAccentPattern)
if (firstAccentMatch) {
  const matchPos = rootSection + updatedCss.substring(rootSection, darkSection).indexOf(firstAccentMatch[0])
  updatedCss = updatedCss.substring(0, matchPos) +
    `--accent: ${accentLight};` +
    updatedCss.substring(matchPos + firstAccentMatch[0].length)
}

// Update dark mode colors
const darkModeSection = updatedCss.substring(darkSection)
const darkModeUpdated = darkModeSection
  .replace(
    /--autumn-critical:\s*[\d\s%]+;/,
    `--autumn-critical: ${criticalDark};`
  )
  .replace(
    /--autumn-progress:\s*[\d\s%]+;/,
    `--autumn-progress: ${progressDark};`
  )
  .replace(
    lightAccentPattern,
    `--accent: ${accentDark};`
  )

updatedCss = updatedCss.substring(0, darkSection) + darkModeUpdated

// Write updated CSS
writeFileSync(cssPath, updatedCss, 'utf-8')

console.log('✅ Theme colors updated successfully!')
console.log(`📄 Updated file: ${cssPath}`)
