# frozen_string_literal: true

require 'sketchup.rb'
require 'extensions.rb'

module VADA
  module QuickToolFinder
    EXTENSION = SketchupExtension.new('Quick Tool Finder', 'quick_tool_finder/main') unless const_defined?(:EXTENSION, false)
    EXTENSION.description = 'Fast command palette for SketchUp tools and extensions, with aliases and shortcut helpers.'
    EXTENSION.version = '0.2.0'
    EXTENSION.creator = 'VADA / datphuho88-dev'
    EXTENSION.copyright = '2026 VADA'

    Sketchup.register_extension(EXTENSION, true)
  end
end
