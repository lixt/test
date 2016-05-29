'use strict';

d3.chart = d3.chart || {};

d3.chart.architectureTree = function () {

    var svg, tree, treeData, diameter, activeNode, diagonal;

    var height = 1000;
    var width = 1000;
    var maxLabel = 150;

    /**
     * Build the chart
     */
    function chart() {
        tree = d3.layout
            .tree()
            .size([height, width]);

        diagonal = d3.svg.diagonal()
            .projection(function(d) { return [d.y, d.x]; });

        svg = d3
            .select("#graph")
            .append("svg")
            .attr("height", height)
            .attr("width", width)
            .append("g")
            .attr("transform", "translate(" + maxLabel + ",0)");

        var nodes = tree.nodes(treeData),
            links = tree.links(nodes);

        activeNode = null;

        svg.call(updateData, nodes, links);
    }

    /**
     * Update the chart data
     * @param {Object} container
     * @param {Array}  nodes
     */
    var updateData = function (container, nodes, links) {

        // Enrich data
        addDependents(nodes);
        nodes.map(function (node) {
            addIndex(node);
        });

        nodes.forEach(function(d) { d.y = d.depth * maxLabel; });

        var diagonal = d3.svg
            .diagonal()
            .projection(function (d) {
                return [d.y, d.x]
            });

        var linkSelection = svg.selectAll(".link").data(links, function (d) {
            return d.source.name + d.target.name + Math.random();
        });
        linkSelection.exit().remove();

        linkSelection.enter().append("path")
            .attr("class", "link")
            .attr("d", diagonal);

        var node = container.selectAll(".node").data(nodes, function (d) {
            return d.name + Math.random();  // always update node
        });
        node.exit().remove();

        var nodeEnter = node
            .enter()
            .append("g")
            .attr("class", "node")
            .attr("transform", function (d) {
                return "translate(" + d.y + "," + d.x + ")";
            });

        nodeEnter.append("circle")
            .attr("r", function (d) {
                return 4.5 * (d.size || 1);
            })
            .style('stroke', function (d) {
                return d3.scale.linear()
                    .domain([1, 0])
                    .range(["steelblue", "red"])(typeof d.satisfaction !== "undefined" ? d.satisfaction : 1);
            })
            .style('fill', function (d) {
                if (typeof d.satisfaction === "undefined") return '#fff';
                return d3.scale.linear()
                    .domain([1, 0])
                    .range(["white", "#f66"])(typeof d.satisfaction !== "undefined" ? d.satisfaction : 1);
            });

        nodeEnter.append("text")
            // .attr("x", function(d){
            //     var spacing = computeRadius(d) + 5;
            //     return d.children || d._children ? -spacing : spacing;
            // })
            .attr('dx', "10")
            .attr("dy", "3")
            .attr("text-anchor", function (d) {
                return "start";
            })
            .text(function (d) {
                return d.name;
            })
        //.style("fill-opacity", 0);
        // .attr("dy", ".31em")
        // .attr("text-anchor", function(d) { return d.x < 180 ? "start" : "end"; })
        // .attr("transform", function(d) { return d.x < 180 ? "translate(8)" : "rotate(180)translate(-8)"; })
        // .attr("transform", function(d) { return "translate(" + d.y + "," + d.x + ")"; })
        // .text(function(d) {
        //     return d.name;
        // });
    };

    /**
     * Add the node dependents in the tree
     * @param {Array} nodes
     */
    var addDependents = function (nodes) {
        var dependents = [];
        nodes.forEach(function (node) {
            if (node.dependsOn) {
                node.dependsOn.forEach(function (dependsOn) {
                    if (!dependents[dependsOn]) {
                        dependents[dependsOn] = [];
                    }
                    dependents[dependsOn].push(node.name);
                });
            }
        });
        nodes.forEach(function (node, index) {
            if (dependents[node.name]) {
                nodes[index].dependents = dependents[node.name];
            }
        });
    };

    /**
     * Add indices to a node, including inherited ones.
     *
     * Mutates the given node (datum).
     *
     * Example added properties:
     * {
     *   index: {
     *     relatedNodes: ["Foo", "Bar", "Baz", "Buzz"],
     *     technos: ["Foo", "Bar"],
     *     host: ["OVH", "fo"] 
     *   }
     * }
     */
    var addIndex = function (node) {
        node.index = {
            relatedNodes: [],
            technos: [],
            hosts: []
        };
        var dependsOn = getDetailCascade(node, 'dependsOn');
        if (dependsOn.length > 0) {
            node.index.relatedNodes = node.index.relatedNodes.concat(dependsOn);
        }
        if (node.dependents) {
            node.index.relatedNodes = node.index.relatedNodes.concat(node.dependents);
        }
        var technos = getDetailCascade(node, 'technos');
        if (technos.length > 0) {
            node.index.technos = technos;
        }
        var hosts = getHostsCascade(node);
        if (hosts.length > 0) {
            node.index.hosts = hosts;
        }
    };

    var getDetailCascade = function (node, detailName) {
        var values = [];
        if (node[detailName]) {
            node[detailName].forEach(function (value) {
                values.push(value);
            });
        }
        if (node.parent) {
            values = values.concat(getDetailCascade(node.parent, detailName));
        }
        return values;
    };

    var getHostsCascade = function (node) {
        var values = [];
        if (node.host) {
            for (var i in node.host) {
                values.push(i);
            }
        }
        if (node.parent) {
            values = values.concat(getHostsCascade(node.parent));
        }
        return values;
    };

    var fade = function (opacity) {
        return function (node) {
            //if (!node.dependsOn || !(node.parent && node.parent.dependsOn)) return;
            svg.selectAll(".node")
                .filter(function (d) {
                    if (d.name === node.name) return false;
                    return node.index.relatedNodes.indexOf(d.name) === -1;
                })
                .transition()
                .style("opacity", opacity);
        };
    };

    var filters = {
        name: '',
        technos: [],
        hosts: []
    };

    var isFoundByFilter = function (d) {
        var i;
        if (!filters.name && !filters.technos.length && !filters.hosts.length) {
            // nothing selected
            return true;
        }
        if (filters.name) {
            if (d.name.toLowerCase().indexOf(filters.name) === -1) return false;
        }
        var technosCount = filters.technos.length;
        if (technosCount) {
            if (d.index.technos.length === 0) return false;
            for (i = 0; i < technosCount; i++) {
                if (d.index.technos.indexOf(filters.technos[i]) === -1) return false;
            }
        }
        var hostCount = filters.hosts.length;
        if (hostCount) {
            if (d.index.hosts.length === 0) return false;
            for (i = 0; i < hostCount; i++) {
                if (d.index.hosts.indexOf(filters.hosts[i]) === -1) return false;
            }
        }
        return true;
    };

    var refreshFilters = function () {
        d3.selectAll('.node').classed('notFound', function (d) {
            return !isFoundByFilter(d);
        });
    };

    var select = function (name) {
        if (activeNode && activeNode.name == name) {
            unselect();
            return;
        }
        unselect();
        svg.selectAll(".node")
            .filter(function (d) {
                if (d.name === name) return true;
            })
            .each(function (d) {
                document.querySelector('#panel').dispatchEvent(
                    new CustomEvent("selectNode", {"detail": d.name})
                );
                d3.select(this).attr("id", "node-active");
                activeNode = d;
                fade(0.1)(d);
            });
    };

    var unselect = function () {
        if (activeNode == null) return;
        fade(1)(activeNode);
        d3.select('#node-active').attr("id", null);
        activeNode = null;
        document.querySelector('#panel').dispatchEvent(
            new CustomEvent("unSelectNode")
        );
    };

    chart.select = select;
    chart.unselect = unselect;

    chart.data = function (value) {
        if (!arguments.length) return treeData;
        treeData = value;
        return chart;
    };

    chart.diameter = function (value) {
        if (!arguments.length) return diameter;
        diameter = value;
        return chart;
    };

    chart.nameFilter = function (nameFilter) {
        filters.name = nameFilter;
        refreshFilters();
    };

    chart.technosFilter = function (technosFilter) {
        filters.technos = technosFilter;
        refreshFilters();
    };

    chart.hostsFilter = function (hostsFilter) {
        filters.hosts = hostsFilter;
        refreshFilters();
    };

    return chart;
};
