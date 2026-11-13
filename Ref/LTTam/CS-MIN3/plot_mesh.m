function plot_mesh(nodes,gcoord)
hold on; grid
trisurf(nodes,gcoord(:,1),gcoord(:,2),gcoord(:,3))
for i=1:length(gcoord)
    text(gcoord(i,1),gcoord(i,2),gcoord(i,3),num2str(i))
end
xlabel('X'); ylabel('Y'), zlabel('Z')
view(53,32)
