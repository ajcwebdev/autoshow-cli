export type CharacterSketchCommandDependencies = {
  requestImage?: typeof import('~/cli/commands/process-steps/step-8-comic/comic-image-services/comic-image-targets').createImage
  writeImage?: typeof import('~/cli/commands/process-steps/step-8-comic/comic-image-services/image-writer').writeGeneratedImage
  composeSheet?: typeof import('~/cli/commands/process-steps/step-8-comic/comic-commands/character-sketch/character-sketch-sheet').combineCharacterSketchSheet
  createGenerationId?: () => string
}
