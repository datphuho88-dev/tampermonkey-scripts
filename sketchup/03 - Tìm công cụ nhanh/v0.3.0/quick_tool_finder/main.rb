# frozen_string_literal: true

require 'sketchup.rb'
require 'json'
require 'digest/sha1'

module VADA
  module QuickToolFinder
    VERSION = '0.3.0'
    PREF_KEY = 'VADA_QuickToolFinder'
    DIALOG_TITLE = 'Quick Tool Finder'
    TOOLBAR_NAME = 'Quick Tool Finder'
    QUICK_TOOLS_TOOLBAR = 'Quick Tools'
    ALIASES_KEY = 'aliases_json'
    PINS_KEY = 'pins_json'

    class << self
      def show
        unless defined?(UI::HtmlDialog)
          UI.messagebox('Quick Tool Finder requires SketchUp 2017 or newer.')
          return
        end

        unless command_proc_supported?
          UI.messagebox('Quick Tool Finder can search/run extension commands on SketchUp 2022 or newer.')
          return
        end

        build_index if @command_records.nil? || @command_records.empty?
        create_dialog unless @dialog
        @dialog.show
        @dialog.bring_to_front if @dialog.respond_to?(:bring_to_front)
      rescue StandardError => e
        UI.messagebox("Quick Tool Finder error.\n\n#{e.class}: #{e.message}")
      end

      def command_proc_supported?
        UI::Command.instance_methods.include?(:proc)
      rescue StandardError
        false
      end

      def build_index
        @commands = {}
        @commands_by_key = {}
        @records_by_key = {}
        @command_records = []
        seen = {}

        ObjectSpace.each_object(UI::Command) do |command|
          add_command(command, seen)
        end

        begin
          ObjectSpace.each_object(UI::Toolbar) do |toolbar|
            next unless toolbar.respond_to?(:each)
            toolbar.each do |item|
              add_command(item, seen, safe_text { toolbar.name }) if item.is_a?(UI::Command)
            end
          end
        rescue StandardError
          nil
        end

        @command_records.each { |record| apply_saved_data!(record) }
        @command_records.sort_by! do |item|
          [item[:pinned] ? 0 : 1, item[:alias].to_s.empty? ? 1 : 0, item[:name].downcase]
        end
        @command_records
      end

      def add_command(command, seen, toolbar_name = nil)
        return unless command.respond_to?(:proc)

        oid = command.object_id
        return if seen[oid]
        return if own_command?(command)

        action = safe_call { command.proc }
        return unless action.respond_to?(:call)

        name = clean_text(safe_call { command.menu_text })
        tooltip = clean_text(safe_call { command.tooltip })
        status = clean_text(safe_call { command.status_bar_text })
        name = tooltip if name.empty?
        return if name.empty?

        extension_name = clean_text(safe_call do
          ext = command.respond_to?(:extension) ? command.extension : nil
          ext && ext.respond_to?(:name) ? ext.name : nil
        end)

        source_path = clean_text(safe_call do
          location = action.respond_to?(:source_location) ? action.source_location : nil
          location && location.first ? File.expand_path(location.first) : nil
        end)
        source = source_path.empty? ? '' : File.basename(File.dirname(source_path))

        small_icon = command_icon_path(command, :small_icon)
        large_icon = command_icon_path(command, :large_icon)
        toolbar = clean_text(toolbar_name)
        key = command_key(name, tooltip, status, extension_name, source_path, toolbar)
        id = oid.to_s

        record = {
          id: id,
          key: key,
          name: name,
          alias: '',
          shortcut: '',
          pinned: false,
          tooltip: tooltip,
          status: status,
          extension: extension_name,
          source: source,
          toolbar: toolbar,
          small_icon: small_icon,
          large_icon: large_icon
        }

        @commands[id] = command
        @commands_by_key[key] = command
        @records_by_key[key] = record
        @command_records << record
        seen[oid] = true
      end

      def command_icon_path(command, method_name)
        return '' unless command.respond_to?(method_name)
        path = clean_text(safe_call { command.public_send(method_name) })
        return '' if path.empty?
        expanded = File.expand_path(path) rescue path
        File.file?(expanded) ? expanded : path
      rescue StandardError
        ''
      end

      def command_key(name, tooltip, status, extension_name, source_path, toolbar)
        raw = [name, tooltip, status, extension_name, source_path, toolbar].map { |v| clean_text(v).downcase }.join("\u001F")
        Digest::SHA1.hexdigest(raw)
      end

      def create_dialog
        html_path = File.join(__dir__, 'ui.html')
        @dialog = UI::HtmlDialog.new(
          dialog_title: DIALOG_TITLE,
          preferences_key: PREF_KEY,
          scrollable: false,
          resizable: true,
          width: 820,
          height: 620,
          min_width: 560,
          min_height: 420,
          style: UI::HtmlDialog::STYLE_DIALOG
        )
        @dialog.set_file(html_path)

        @dialog.add_action_callback('ready') { |_context| push_index_to_dialog }
        @dialog.add_action_callback('refresh') do |_context|
          build_index
          push_index_to_dialog
        end
        @dialog.add_action_callback('run') do |_context, command_id|
          command = @commands && @commands[command_id.to_s]
          next unless command

          dialog = @dialog
          @dialog = nil
          dialog.close if dialog
          UI.start_timer(0.05, false) { execute_command(command) }
        end
        @dialog.add_action_callback('editAlias') { |_context, key| edit_alias(key.to_s) }
        @dialog.add_action_callback('shortcut') { |_context, key| prepare_shortcut(key.to_s) }
        @dialog.add_action_callback('pin') { |_context, key| pin_tool(key.to_s) }
        @dialog.add_action_callback('finderShortcut') { |_context| show_shortcuts_help('Quick Tool Finder') }
        @dialog.add_action_callback('showToolbar') { |_context| force_show_toolbar }
        @dialog.add_action_callback('showQuickTools') { |_context| force_show_quick_tools_toolbar }
        @dialog.set_on_closed { @dialog = nil }
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
          if (defined?(MF_DISABLED) && state == MF_DISABLED) || (defined?(MF_GRAYED) && state == MF_GRAYED)
            UI.messagebox('This command is currently disabled in the current SketchUp context.')
            return
          end
        end

        action = command.proc
        action.call
      rescue StandardError => e
        UI.messagebox("Could not run command.\n\n#{e.class}: #{e.message}")
      end

      def run_by_key(key)
        build_index if @commands_by_key.nil?
        command = @commands_by_key[key]

        unless command
          build_index
          command = @commands_by_key[key]
        end

        unless command
          saved = saved_entry_for_key(key)
          command = find_command_fallback(saved) if saved
        end

        if command
          execute_command(command)
        else
          UI.messagebox('Không tìm thấy công cụ gốc. Hãy mở Quick Tool Finder và bấm ↻ để quét lại.')
        end
      end

      def saved_entry_for_key(key)
        alias_entry_for_key(key) || pin_entry_for_key(key)
      end

      def find_command_fallback(saved)
        return nil unless saved
        build_index if @command_records.nil?

        name = clean_text(saved['target_name'])
        extension_name = clean_text(saved['extension'])
        source = clean_text(saved['source'])

        record = @command_records.find do |item|
          next false unless item[:name].casecmp?(name)
          ext_ok = extension_name.empty? || item[:extension].casecmp?(extension_name)
          src_ok = source.empty? || item[:source].casecmp?(source)
          ext_ok && src_ok
        end
        record && @commands[record[:id]]
      end

      def edit_alias(key)
        build_index if @records_by_key.nil?
        record = @records_by_key[key]
        return unless record

        current = alias_for_key(key).to_s
        result = UI.inputbox(['Tên gợi nhớ:'], [current], "Đặt tên cho: #{record[:name]}")
        return unless result

        value = clean_text(result[0])
        if value.empty?
          remove_alias(key)
        else
          save_alias(record, value)
        end

        build_index
        push_index_to_dialog
      rescue StandardError => e
        UI.messagebox("Không lưu được tên gợi nhớ.\n\n#{e.class}: #{e.message}")
      end

      def prepare_shortcut(key)
        build_index if @records_by_key.nil?
        record = @records_by_key[key]
        return unless record

        saved_alias = alias_for_key(key).to_s
        if saved_alias.empty?
          result = UI.inputbox(
            ['Tên gợi nhớ trước khi tạo phím tắt:'],
            [record[:name]],
            "Phím tắt cho: #{record[:name]}"
          )
          return unless result
          saved_alias = clean_text(result[0])
          return if saved_alias.empty?
          save_alias(record, saved_alias)
          build_index
        end

        register_alias_command(alias_entry_for_key(key))
        push_index_to_dialog
        show_shortcuts_help(saved_alias)
      rescue StandardError => e
        UI.messagebox("Không chuẩn bị được phím tắt.\n\n#{e.class}: #{e.message}")
      end

      def pin_tool(key)
        build_index if @records_by_key.nil?
        record = @records_by_key[key]
        return unless record

        if pinned_key?(key)
          force_show_quick_tools_toolbar
          UI.messagebox("'#{display_name_for_record(record)}' đã được ghim trên thanh Quick Tools.")
          return
        end

        entry = {
          'key' => record[:key],
          'target_name' => record[:name],
          'alias' => clean_text(record[:alias]),
          'extension' => record[:extension],
          'source' => record[:source],
          'toolbar' => record[:toolbar],
          'small_icon' => record[:small_icon],
          'large_icon' => record[:large_icon]
        }
        pins << entry
        persist_pins
        register_pin_command(entry)
        force_show_quick_tools_toolbar

        record[:pinned] = true
        push_index_to_dialog
      rescue StandardError => e
        UI.messagebox("Không ghim được công cụ.\n\n#{e.class}: #{e.message}")
      end

      def display_name_for_record(record)
        name = clean_text(record[:alias])
        name.empty? ? clean_text(record[:name]) : name
      end

      def show_shortcuts_help(search_text)
        UI.messagebox(
          "SketchUp không có API chính thức để plugin tự ghi phím tắt.\n\n" \
          "Tôi đã tạo lệnh có tên: #{search_text}\n" \
          "Cửa sổ Shortcuts sẽ mở. Tìm '#{search_text}' rồi gán phím bạn muốn."
        )

        page = begin
          pages = UI.respond_to?(:preferences_pages) ? UI.preferences_pages : []
          pages.find { |name| name.to_s.downcase.include?('shortcut') } || 'Shortcuts'
        rescue StandardError
          'Shortcuts'
        end
        UI.show_preferences(page)
      end

      def aliases
        @aliases ||= read_json_array(ALIASES_KEY)
      end

      def pins
        @pins ||= read_json_array(PINS_KEY)
      end

      def read_json_array(key)
        raw = Sketchup.read_default(PREF_KEY, key, '[]').to_s
        parsed = JSON.parse(raw)
        parsed.is_a?(Array) ? parsed : []
      rescue StandardError
        []
      end

      def alias_entry_for_key(key)
        aliases.find { |item| item['key'] == key }
      end

      def pin_entry_for_key(key)
        pins.find { |item| item['key'] == key }
      end

      def alias_for_key(key)
        item = alias_entry_for_key(key)
        item && item['alias']
      end

      def pinned_key?(key)
        !!pin_entry_for_key(key)
      end

      def save_alias(record, alias_name)
        normalized = clean_text(alias_name)
        return if normalized.empty?

        aliases.reject! do |item|
          item['key'] == record[:key] || clean_text(item['alias']).casecmp?(normalized)
        end
        aliases << {
          'key' => record[:key],
          'alias' => normalized,
          'target_name' => record[:name],
          'extension' => record[:extension],
          'source' => record[:source],
          'toolbar' => record[:toolbar]
        }
        persist_aliases
        register_alias_command(alias_entry_for_key(record[:key]))

        pin = pin_entry_for_key(record[:key])
        if pin
          pin['alias'] = normalized
          persist_pins
        end
      end

      def remove_alias(key)
        aliases.reject! { |item| item['key'] == key }
        persist_aliases
        pin = pin_entry_for_key(key)
        if pin
          pin['alias'] = ''
          persist_pins
        end
      end

      def persist_aliases
        Sketchup.write_default(PREF_KEY, ALIASES_KEY, JSON.generate(aliases))
      end

      def persist_pins
        Sketchup.write_default(PREF_KEY, PINS_KEY, JSON.generate(pins))
      end

      def apply_saved_data!(record)
        entry = alias_entry_for_key(record[:key])
        if entry
          record[:alias] = clean_text(entry['alias'])
          record[:shortcut] = shortcut_for_alias(record[:alias])
        end
        record[:pinned] = pinned_key?(record[:key])
        record
      end

      def shortcut_for_alias(alias_name)
        name = clean_text(alias_name)
        return '' if name.empty?

        shortcuts = Sketchup.respond_to?(:get_shortcuts) ? Sketchup.get_shortcuts : []
        matches = shortcuts.filter_map do |line|
          shortcut, path = line.to_s.split("\t", 2)
          next unless path
          leaf = path.split('/').last.to_s
          next unless leaf.casecmp?(name) || leaf.downcase.include?(name.downcase)
          shortcut.to_s.strip
        end
        matches.reject(&:empty?).uniq.join(', ')
      rescue StandardError
        ''
      end

      def register_saved_alias_commands
        aliases.each { |entry| register_alias_command(entry) }
      end

      def register_alias_command(entry)
        return unless entry.is_a?(Hash)
        key = clean_text(entry['key'])
        name = clean_text(entry['alias'])
        return if key.empty? || name.empty?

        @registered_aliases ||= {}
        return if @registered_aliases[key] == name

        command = UI::Command.new(name) { run_by_key(key) }
        command.tooltip = "#{name} → #{clean_text(entry['target_name'])}"
        command.status_bar_text = "Quick Tool Finder alias for #{clean_text(entry['target_name'])}"
        command.extension = EXTENSION if command.respond_to?(:extension=) && const_defined?(:EXTENSION, false)
        track_own_command(command)

        alias_menu.add_item(command)
        @alias_commands ||= []
        @alias_commands << command
        @registered_aliases[key] = name
      rescue StandardError
        nil
      end

      def register_saved_pin_commands
        pins.each { |entry| register_pin_command(entry) }
      end

      def register_pin_command(entry)
        return unless entry.is_a?(Hash)
        key = clean_text(entry['key'])
        return if key.empty?

        @registered_pins ||= {}
        return @registered_pins[key] if @registered_pins[key]

        target_name = clean_text(entry['target_name'])
        alias_name = clean_text(entry['alias'])
        label = alias_name.empty? ? target_name : alias_name
        label = 'Quick Tool' if label.empty?

        command = UI::Command.new(label) { run_by_key(key) }
        command.tooltip = alias_name.empty? ? target_name : "#{alias_name} → #{target_name}"
        command.status_bar_text = "Quick Tools: #{target_name}"
        command.extension = EXTENSION if command.respond_to?(:extension=) && const_defined?(:EXTENSION, false)
        apply_pin_icons(command, entry)
        track_own_command(command)

        quick_tools_toolbar.add_item(command)
        @pin_commands ||= []
        @pin_commands << command
        @registered_pins[key] = command
        command
      rescue StandardError
        nil
      end

      def apply_pin_icons(command, entry)
        small = usable_icon(entry['small_icon']) || File.join(__dir__, 'icons', 'pin_24.png')
        large = usable_icon(entry['large_icon']) || File.join(__dir__, 'icons', 'pin_32.png')
        command.small_icon = small if File.file?(small)
        command.large_icon = large if File.file?(large)
      rescue StandardError
        nil
      end

      def usable_icon(path)
        value = clean_text(path)
        return nil if value.empty?
        expanded = File.expand_path(value) rescue value
        File.file?(expanded) ? expanded : nil
      rescue StandardError
        nil
      end

      def extension_menu
        UI.menu('Extensions')
      rescue StandardError
        UI.menu('Plugins')
      end

      def qtf_menu
        @qtf_menu ||= extension_menu.add_submenu('Quick Tool Finder')
      end

      def alias_menu
        @alias_menu ||= qtf_menu.add_submenu('Tên gợi nhớ')
      end

      def quick_tools_toolbar
        @quick_tools_toolbar ||= UI::Toolbar.new(QUICK_TOOLS_TOOLBAR)
      end

      def setup_ui
        @own_command_ids = {}

        finder_command = UI::Command.new('Quick Tool Finder') { show }
        finder_command.tooltip = 'Quick Tool Finder'
        finder_command.status_bar_text = 'Search and run SketchUp tools quickly.'
        finder_command.menu_text = 'Mở Quick Tool Finder' if finder_command.respond_to?(:menu_text=)
        finder_command.extension = EXTENSION if finder_command.respond_to?(:extension=) && const_defined?(:EXTENSION, false)
        track_own_command(finder_command)

        small_icon = File.join(__dir__, 'icons', 'search_24.png')
        large_icon = File.join(__dir__, 'icons', 'search_32.png')
        finder_command.small_icon = small_icon if File.file?(small_icon)
        finder_command.large_icon = large_icon if File.file?(large_icon)

        qtf_menu.add_item(finder_command)
        qtf_menu.add_item('Hiện icon Quick Tool Finder') { force_show_toolbar }
        qtf_menu.add_item('Hiện thanh Quick Tools đã ghim') { force_show_quick_tools_toolbar }
        qtf_menu.add_item('Đặt phím tắt cho Quick Tool Finder') { show_shortcuts_help('Quick Tool Finder') }
        qtf_menu.add_separator
        alias_menu

        @toolbar = UI::Toolbar.new(TOOLBAR_NAME)
        @toolbar.add_item(finder_command)
        force_show_toolbar

        quick_tools_toolbar
        register_saved_alias_commands
        register_saved_pin_commands
        force_show_quick_tools_toolbar unless pins.empty?
      rescue StandardError => e
        UI.messagebox("Quick Tool Finder could not initialize its toolbar.\n\n#{e.class}: #{e.message}")
      end

      def force_show_toolbar
        show_named_toolbar(@toolbar, TOOLBAR_NAME)
      end

      def force_show_quick_tools_toolbar
        show_named_toolbar(quick_tools_toolbar, QUICK_TOOLS_TOOLBAR)
      end

      def show_named_toolbar(toolbar, name)
        toolbar.show if toolbar
        UI.set_toolbar_visible(name, true) if UI.respond_to?(:set_toolbar_visible)
        UI.start_timer(0.25, false) do
          begin
            toolbar.show if toolbar
            UI.set_toolbar_visible(name, true) if UI.respond_to?(:set_toolbar_visible)
          rescue StandardError
            nil
          end
        end
        true
      rescue StandardError
        false
      end

      def track_own_command(command)
        @own_command_ids ||= {}
        @own_command_ids[command.object_id] = true
        command
      end

      def own_command?(command)
        @own_command_ids && @own_command_ids[command.object_id]
      end

      def safe_call
        yield
      rescue StandardError
        nil
      end

      def safe_text
        clean_text(yield)
      rescue StandardError
        ''
      end

      def clean_text(value)
        value.to_s.encode('UTF-8', invalid: :replace, undef: :replace, replace: '').strip
      rescue StandardError
        value.to_s.strip
      end
    end

    unless file_loaded?(__FILE__)
      setup_ui
      file_loaded(__FILE__)
    end
  end
end
