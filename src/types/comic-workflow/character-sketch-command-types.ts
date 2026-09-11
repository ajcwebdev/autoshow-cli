export type CharacterSketchCommandDependencies = {
  requestImage?: typeof import('~/cli/commands/visuals/comic/comic-image-services/comic-image-targets').createImage
  writeImage?: typeof import('~/cli/commands/visuals/comic/comic-image-services/image-writer').writeGeneratedImage
  composeSheet?: typeof import('~/cli/commands/visuals/comic/comic-commands/character-sketch/character-sketch-sheet').combineCharacterSketchSheet
  createGenerationId?: () => string
}
