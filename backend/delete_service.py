from flask import jsonify, session
from backend.RSDB_kv_service import get_kv, set_kv
from backend.error import ErrorCode
from backend.node import Node
from backend.share_manager import ShareManager

def delete_node(data):
    if 'node_path' not in data:
        return jsonify({'message': ErrorCode.INVALID_REQUEST.name}), 400

    if 'delete_in_root' not in data:
        return jsonify({'message': ErrorCode.INVALID_REQUEST.name}), 400
    
    node_path = data['node_path']
    username = session['username']
    is_root = data['delete_in_root']
    if isinstance(is_root, str):
        is_root = is_root.lower() == 'true'

    if is_root:
        root = Node.from_json(get_kv(username + " ROOT"))

        if node_path.strip("/") == "":
            return jsonify({'message': ErrorCode.DELETE_ROOT_DIRECTORY.name}), 400

        parts = node_path.strip("/").split("/")
        node_name = parts[-1]
        parent_path = "/".join(parts[:-1])

        parent_node = root.find_node_by_path(parent_path) if parent_path else root

        if parent_node is None or not parent_node.is_folder:
            return jsonify({'message': ErrorCode.INVALID_PATH.name}), 400

        if node_name not in parent_node.children:
            return jsonify({'message': ErrorCode.NODE_NOT_FOUND.name}), 404

        del parent_node.children[node_name]

        set_kv(username + " ROOT", root.to_json())

        return jsonify({'message': ErrorCode.SUCCESS.name,
                        'root': root.to_json()}), 200
    else:
        share_json = get_kv(username + " SHARE_MANAGER")
        share_manager = ShareManager.from_json(share_json)

        target_node = share_manager.find_node_by_path(node_path)
        if target_node is None:
            return jsonify({'message': ErrorCode.NODE_NOT_FOUND.name}), 404

        from_user = node_path.strip("/").split("/")[0]

        result = share_manager.delete(from_user, target_node)
        set_kv(username + " SHARE_MANAGER", share_manager.to_json())

        return jsonify({'message': result.name,
                        'root': share_manager.to_json()}), 200
