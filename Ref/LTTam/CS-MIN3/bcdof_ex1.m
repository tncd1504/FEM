function [bcdof, bcval]=bcdof_ex1(ndof,Mesh_space_x,Mesh_space_y)

bcdof=[];
bcval=[];
for i=1:Mesh_space_x+1
        bcdof=[bcdof ndof*(i-1)+1 ndof*(i-1)+5 ndof*(i-1)+6]; 
        % Upper boundary along y axis is symmetric constrained u, theatay, thetaz
        bcval=[bcval 0 0 0];
end

for i=1:Mesh_space_y+1
        bcdof=[bcdof ndof*(i-1)*(Mesh_space_x+1)+1 ndof*(i-1)*(Mesh_space_x+1)+3 ]; 
        % Left boundary along x axis is constrained by diaphram constrained u, w
        bcval=[bcval 0 0];
end

for i=1:Mesh_space_y+1
        bcdof=[bcdof ndof*i*(Mesh_space_x+1)-4 ndof*i*(Mesh_space_x+1)-2 ndof*i*(Mesh_space_x+1)]; 
        % Right boundary along x axis is symmetric constrained v, thetax, thetaz
        bcval=[bcval 0 0 0];
end
