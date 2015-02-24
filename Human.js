var Human = {
	Title: 'Human',
	Version: V(0, 1, 0),
	Description: 'Obey the human condition.',
	Author: 'Jack Williams',
	HasConfig: true,

	Init: function () {
		max_alignment = 1000;
		min_alignment = -1000;
	},

	LoadDefaultConfig: function () {
		this.Config = {};
		this.Config.authLevel = 2;

		this.Config.options = {
			show_at_beginning: false,
			notify_alignment_change: true,

			score_tag: '{score}',
			name_tag: '{name}',
			format: ' [{name} ({score})]'
		};

		this.Config.scores = {
			default: {
				score: 0,
				dynamic: false
			},

			killing: {
				score: -100,
				dynamic: false
			},

			damage: {
				score: -10,
				dynamic: true
			},

			destruction: {
				score: -10,
				dynamic: true
			},

			stealing: {
				score: -1,
				dynamic: false
			},

			justice: {
				score: -2,
				dynamic: true
			}
		};

		this.Config.alignments = {
			'1000': 'Defender of the People',
			'500': 'Paragon',
			'100': 'Do-Gooder',
			'50': 'Citizen',
			'0': 'Naked Wanderer',
			'-10': 'Petty Thief',
			'-50': 'Brawler',
			'-100': 'Killer',
			'-1000': 'Psycho'
		};

		this.Config.players = {};
	},

	OnPlayerInit: function (player) {
		print('SETTING UP PLAYER ' + player.displayName);

		this.set_player_status(player);
	},

	// OnEntityAttacked: function (entity, hit) {
	// 	var victim = entity.userID && entity.ToPlayer();

	// 	if (!victim) {
	// 		return;
	// 	}

	// 	print(victim);

	// 	var attacker = hit.Initiator && hit.Initiator.ToPlayer();

	// 	if (!attacker || victim.userID === attacker.userID) {
	// 		return;
	// 	}

	// 	// print(hit.damageTypes.Total());
	// 	print(attacker);

	// 	var damage_done = hit.damageTypes.Total();
	// 	var score_difference = 0 - Math.ceil(damage_done);

	// 	// print(score_difference);

	// 	this.update_alignment(attacker, score_difference);
	// },

	calculate_score: function (amount, type, is_good) { //amount: -10
		var type_base_score = this.Config.scores[type].score, //-10
			is_dynamic = this.Config.scores[type].dynamic; //true
			
		if (!is_dynamic || type_base_score === 0) {
			return type_base_score;
		}

		var score = Math.ceil((type_base_score < 0) ? Math.abs(amount / type_base_score) : Math.abs(amount * type_base_score));

		if (!is_good) {
			score *= -1;
		}

		return score;
	},

	calculate_colour: function (alignment) {
		var r = 255,
			g = 255,
			b = 255;

		if (alignment < 0) {
			if (alignment <= min_alignment) {
				g = 0;
				b = 0;
			} else {
				g = 255 - (255 / Math.abs(min_alignment)) * Math.abs(alignment);
				b = 255 - (255 / Math.abs(min_alignment)) * Math.abs(alignment);
			}
		} else if (alignment > 0) {
			if (alignment >= max_alignment) {
				r = 0;
				b = 0;
			} else {
				r = 255 - (255 / Math.abs(max_alignment)) * Math.abs(alignment);
				b = 255 - (255 / Math.abs(max_alignment)) * Math.abs(alignment);
			}
		}

		var code = '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).substring(0, 6);

		return code;
	},

	OnPlayerAttack: function (attacker, hit) {
		var victim = hit.HitEntity && hit.HitEntity.ToPlayer();

		if (!victim || victim.userID === attacker.userID) {
			return;
		}

		var damage = Math.ceil(hit.damageTypes.Total());

		if (damage === 0) {
			return;
		}

		// var victim_pid = '76561197979546789',
		var victim_pid = rust.UserIDFromPlayer(victim),
			attacker_pid = rust.UserIDFromPlayer(attacker),
			is_good_deed = (this.Config.players[victim_pid].alignment < 0 && this.Config.players[attacker_pid].alignment > this.Config.players[victim_pid].alignment),
			score = this.calculate_score(damage, 'damage', is_good_deed);

		print(score);

		if (score !== 0) {
			this.update_alignment(attacker, score);
		}
	},

	OnEntityDeath: function (entity, hit) {
		var victim = entity.userID && entity.ToPlayer();

		if (!victim) {
			return false;
		}

		var attacker = hit.Initiator && hit.Initiator.ToPlayer();

		if (!attacker || attacker.userID === victim.userID) {
			return false;
		}

		this.update_alignment(attacker, this.Config.scores.killing.score);
	},

	// OnItemRemovedFromContainer: function (container, item) {

	// },

	OnPlayerChat: function (args) {
		var msg = args.GetString(0, 'text').trim().substring(0, 128),
			player = args.connection.player,
			pid = rust.UserIDFromPlayer(player);

		if (
			!msg.length || 
			msg.charAt(0) == '/' || 
			msg.charAt(0) == '\\' || (
				msg.indexOf('<') > -1 && (
					msg.indexOf('<size') > -1 ||
					msg.indexOf('<color') > -1 ||
					msg.indexOf('<material') > -1 ||
					msg.indexOf('<quad') > -1 ||
					msg.indexOf('<b>') > -1 ||
					msg.indexOf('<i>') > -1
				)
			)
		) {
			return;
		}

		rust.BroadcastChat('<color="' + this.calculate_colour(this.Config.players[pid].alignment) + '">' + player.displayName + '</color>', msg, pid);
		return true;
	},

	set_player_status: function (player) {
		if (!player) {
			return false;
		}

		var pid = rust.UserIDFromPlayer(player);

		this.Config.players[pid] = {
			name: player.displayName,
			alignment: this.Config.scores.default.score,
			last_title: this.Config.alignments[this.Config.scores.default.score.toString()]
		};

		this.Config.players[pid].name = player.displayName;
		this.SaveConfig();

		this.update_player_name(pid, player);
	},

	update_player_name: function (pid, player) {
		if (!pid || !player) {
			return false;
		}

		var tag = this.Config.options.format,
			alignment = this.Config.players[pid].alignment,
			show_alignment_score = (tag.indexOf(this.Config.options.score_tag) > -1),

			show_alignment_name = (tag.indexOf(this.Config.options.name_tag) > -1),
			alignment_name = this.get_alignment_name(alignment);

		if (show_alignment_score) {
			tag = tag.replace(this.Config.options.score_tag, alignment);
		}

		if (show_alignment_name) {
			tag = tag.replace(this.Config.options.name_tag, alignment_name);
		}

		player.displayName = (this.Config.options.show_at_beginning ? tag : '') + this.Config.players[pid].name + (!this.Config.options.show_at_beginning ? tag : '');

		if (this.Config.options.notify_alignment_change && alignment_name != this.Config.players[pid].last_title) {
			rust.BroadcastChat(this.Title, this.Config.players[pid].name + ' has become a ' + alignment_name + '!', 0);
		}

		this.Config.players[pid].last_title = alignment_name;
		this.SaveConfig();
	},

	update_alignment: function (player, amount) {
		var pid = rust.UserIDFromPlayer(player);

		this.Config.players[pid].alignment += Number(amount);
		this.SaveConfig();

		var message = ((amount > 0) ? '+' : '') + amount + ' reputation ' + ((amount > 0) ? 'gained' : 'lost') + '!';

		rust.SendChatMessage(player, '<color="' + ((amount > 0) ? '#00ff00' : '#ff0000') + '">' + this.Title + '</color>', message, 0);

		this.update_player_name(pid, player);
	},

	get_alignment_name: function (score) {
		// var aligment_thresholds = Object.keys(this.Config.alignments).map(Number),
		var aligment_thresholds = [1000, 500, 100, 50, 0, -10, -50, -100, -1000],
			len = aligment_thresholds.length,
			positive_score = (score > 0),
			negative_score = (score < 0),
			best_threshold = 0;

		for (var i = 0; i < len; i++) {
			if (
				(
					positive_score && 
					aligment_thresholds[i] <= score &&
					aligment_thresholds[i] > best_threshold
				) || (
					negative_score &&
					aligment_thresholds[i] >= score &&
					aligment_thresholds[i] < best_threshold
				)
			) {
				best_threshold = aligment_thresholds[i];
			}
		}

		var alignment = this.Config.alignments[best_threshold.toString()];

		return alignment;
	}
};