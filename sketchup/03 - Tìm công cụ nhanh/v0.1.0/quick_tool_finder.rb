# frozen_string_literal: true

require 'sketchup.rb'
require 'extensions.rb'

module QuickToolFinder
  EXTENSION_NAME = 'Quick Tool Finder'

  unless file_loaded?(__FILE__)
    extension = SketchupExtension.new(EXTENSION_NAME, 'quick_tool_finder/main')
    extension.description = 'Fast command palette for SketchUp tools and extensions.'
    extension.version = '0.1.0'
    extension.creator = 'datphuho88-dev'
    extension.copyright = '2026'

    Sketchup.register_extension(extension, true)
    file_loaded(__FILE__)
  end
end
