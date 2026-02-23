class User {
	//properties
	#user_id;
	#password_hash;
	//constructor 
	constructor(username, email, user_id, hash, created_at) {
		this.username = username;
		this.email = email;
		this.#user_id = user_id;
		this.#password_hash = password_hash;
		this.created_at = created_at || new Date();
	}
	//methods
	//getters
	get username() {
		return this.username;
	}
	get email() {
		return this.email;
	}
	get created_at() {
		return this.created_at;
	}
	//setters
	set username(newUsername) {
		this._username
	
}
