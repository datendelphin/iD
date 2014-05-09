iD.geo.Turn = function(turn) {
    turn = _.clone(turn);

    turn.key = function() {
        var components = [turn.from, turn.to, turn.via, turn.toward];
        if (turn.restriction)
            components.push(turn.restriction);
        return components.map(iD.Entity.key).join('-');
    };

    turn.angle = function(projection) {
        var v = projection(turn.via.loc),
            t = projection(turn.toward.loc);

        return Math.atan2(t[1] - v[1], t[0] - v[0]);
    };

    return turn;
};

iD.geo.turns = function(graph, entityID) {
    var entity = graph.entity(entityID);

    if (entity.type === 'relation' && entity.tags.type === 'restriction')
        return restriction(entity);
    if (entity.type !== 'way' || !entity.tags.highway || entity.isArea())
        return [];

    function restriction(relation) {
        var f = relation.memberByRole('from'),
            t = relation.memberByRole('to'),
            v = relation.memberByRole('via');

        if (!f || !t || !v || f.type !== 'way' || t.type !== 'way' || v.type !== 'node')
            return [];

        f = graph.hasEntity(f.id);
        t = graph.hasEntity(t.id);
        v = graph.hasEntity(v.id);

        if (!f || !t || !v || f.isDegenerate() || t.isDegenerate())
            return [];

        return [iD.geo.Turn({
            from: f,
            to: t,
            via: v,
            toward: graph.entity(v.id === t.first() ? t.nodes[1] : t.nodes[t.nodes.length - 2]),
            restriction: relation
        })];
    }

    function withRestriction(turn) {
        graph.parentRelations(turn.from).forEach(function(relation) {
            if (relation.tags.type !== 'restriction')
                return;

            var f = relation.memberByRole('from'),
                t = relation.memberByRole('to'),
                v = relation.memberByRole('via');

            if (f && f.id === turn.from.id &&
                t && t.id === turn.to.id &&
                v && v.id === turn.via.id) {
                turn.restriction = relation;
            }
        });

        return iD.geo.Turn(turn);
    }

    var turns = [];

    [entity.first(), entity.last()].forEach(function(nodeID) {
        var node = graph.entity(nodeID);
        graph.parentWays(node).forEach(function(parent) {
            if (parent === entity || parent.isDegenerate() || !parent.tags.highway)
                return;
            if (entity.first() === node.id && entity.tags.oneway === 'yes')
                return;
            if (entity.last() === node.id && entity.tags.oneway === '-1')
                return;

            var index = parent.nodes.indexOf(node.id);

            // backward
            if (parent.first() !== node.id && parent.tags.oneway !== 'yes') {
                turns.push(withRestriction({
                    from: entity,
                    to: parent,
                    via: node,
                    toward: graph.entity(parent.nodes[index - 1])
                }));
            }

            // forward
            if (parent.last() !== node.id && parent.tags.oneway !== '-1') {
                turns.push(withRestriction({
                    from: entity,
                    to: parent,
                    via: node,
                    toward: graph.entity(parent.nodes[index + 1])
                }));
            }
       });
    });

    return turns;
};
