# frozen_string_literal: true

require 'sketchup.rb'
require 'json'

module QuickToolFinder
  VERSION = '0.1.0'
  PREF_KEY = 'QuickToolFinder'
  DIALOG_TITLE = 'Quick Tool Finder'

  class << self
    def show
      unless command_proc_supported?
        UI.messagebox('Quick Tool Finder requires SketchUp 2022 or newer to run commands from other extensions.')
        return
      end

      build_index if @command_records.nil? || @command_records.empty?
      create_dialog unless @dialog
      @dialog.show
    end

    def command_proc_supported?
      UI::Command.instance_methods.include?(:proc)
    end

    def build_index
      @commands = {}
      @command_records = []
      seen = {}

      ObjectSpace.each_object(UI::Command) do |command|
        add_command(command, seen)
      end

      # Some commands are easier to reach through toolbar enumeration.
      ObjectSpace.each_object(UI::Toolbar) do |toolbar|
        begin
          toolbar.each do |item|
            add_command(item, seen, toolbar.name) if item.is_a?(UI::Command)
          end
        rescue StandardError
          # Ignore third-party toolbar objects that do not enumerate cleanly.
        end
      end

      @command_records.sort_by! { |item| item[:name].downcase }
      @command_records
    end

    def add_command(command, seen, toolbar_name = nil)
      return unless command.respond_to?(:proc)
      oid = command.object_id
      return if seen[oid]

      action = safe_call { command.proc }
      return unless action.respond_to?(:call)

      name = clean_text(safe_call { command.menu_text })
      tooltip = clean_text(safe_call { command.tooltip })
      status = clean_text(safe_call { command.status_bar_text })
      name = tooltip if name.empty?
      return if name.empty?
      return if name == 'Quick Tool Finder'

      extension_name = clean_text(safe_call do
        ext = command.respond_to?(:extension) ? command.extension : nil
        ext && ext.respond_to?(:name) ? ext.name : nil
      end)

      source = clean_text(safe_call do
        location = action.source_location
        location && location.first ? File.basename(File.dirname(location.first)) : nil
      end)

      id = oid.to_s
      @commands[id] = command
      @command_records << {
        id: id,
        name: name,
        tooltip: tooltip,
        status: status,
        extension: extension_name,
        source: source,
        toolbar: clean_text(toolbar_name)
      }
      seen[oid] = true
    end

    def create_dialog
      html_path = File.join(__dir__, 'ui.html')
      @dialog = UI::HtmlDialog.new(
        dialog_title: DIALOG_TITLE,
        preferences_key: PREF_KEY,
        scrollable: false,
        resizable: true,
        width: 680,
        height: 560,
        min_width: 460,
        min_height: 360,
        style: UI::HtmlDialog::STYLE_DIALOG
      )
      @dialog.set_file(html_path)

      @dialog.add_action_callback('ready') do |_context|
        push_index_to_dialog
      end

      @dialog.add_action_callback('refresh') do |_context|
        build_index
        push_index_to_dialog
      end

      @dialog.add_action_callback('run') do |_context, command_id|
        command = @commands && @commands[command_id.to_s]
        next unless command

        # Close before running so SketchUp regains focus for interactive tools.
        dialog = @dialog
        @dialog = nil
        dialog.close if dialog

        UI.start_timer(0.05, false) do
          execute_command(command)
        end
      end

      @dialog.set_on_closed do
        @dialog = nil
      end
    end

    def push_index_to_dialog
      return unless @dialog
      json = JSON.generate(@command_records || [])
      @dialog.execute_script("window.setCommands(#{json});")
    end

    def execute_command(command)
      validation = safe_call do
        command.respond_to?(:get_validation_proc) ? command.get_validation_proc : nil
      end

      if validation.respond_to?(:call)
        state = safe_call { validation.call }
        if state == MF_DISABLED || state == MF_GRAYED
          UI.messagebox('This command is currently disabled in the current SketchUp context.')
          return
        end
      end

      action = command.proc
      action.call
    rescue StandardError => e
      UI.messagebox("Could not run command.\n\n#{e.class}: #{e.message}")
    end

    def safe_call
      yield
    rescue StandardError
      nil
    end

    def clean_text(value)
      value.to_s.encode('UTF-8', invalid: :replace, undef: :replace, replace: '').strip
    rescue StandardError
      value.to_s.strip
    end

    def setup_ui
      icon_path = File.join(__dir__, 'icons', 'search.svg')
      command = UI::Command.new('Quick Tool Finder') { show }
      command.tooltip = 'Quick Tool Finder'
      command.status_bar_text = 'Search and run SketchUp tools quickly.'
      command.small_icon = icon_path if File.exist?(icon_path)
      command.large_icon = icon_path if File.exist?(icon_path)

      UI.menu('Extensions').add_item(command)

      @toolbar = UI::Toolbar.new('Quick Tool Finder')
      @toolbar.add_item(command)

      first_run = Sketchup.read_default(PREF_KEY, 'toolbar_initialized', false)
      if first_run
        @toolbar.restore
      else
        @toolbar.show
        Sketchup.write_default(PREF_KEY, 'toolbar_initialized', true)
      end
    end
  end

  unless file_loaded?(__FILE__)
    setup_ui
    file_loaded(__FILE__)
  end
end
