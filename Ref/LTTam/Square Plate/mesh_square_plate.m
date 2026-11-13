function [nodes,gcoord] = mesh_square_plate(type,L,H,nx,ny)
disx=L/nx;          %kich thuoc moi doan dc chia theo truc x
disy=H/ny;          %kich thuoc moi doan dc chia theo truc y
%--------------------------------------------------------------------------
%                                 FEM Q4
%--------------------------------------------------------------------------

% ----------------------- khai bao toa do nut ---------------------------
if type == 'Q4'
    nn=0;
    for i=1:ny+1
        for j=1:nx+1
            nn=nn+1;
            gcoord(nn,1)=disx*(j-1);
            gcoord(nn,2)=disy*(i-1);
        end
    end
    % ----------------------- khai bao ket noi phan tu-------------------------
    nodes=[];
    for i=1:nx
        for j=1:ny
            nodes=[nodes; (ny+1)*(i-1)+j (ny+1)*(i-1)+j+1 (ny+1)*i+j+1 (ny+1)*i+j];
        end
    end
end
%--------------------------------------------------------------------------
%                                 FEM T3
%--------------------------------------------------------------------------
if type == 'T3'
    nodes = [];
    for i=1:ny
        for j=1:nx
            nodes =[nodes;(nx+1)*(i-1)+j (nx+1)*i+j+1 (nx+1)*i+j;
                (nx+1)*(i-1)+j (nx+1)*(i-1)+j+1 (nx+1)*i+j+1];
        end
        %    return
    end
    
    % ---------------------------- gcoord node --------------------------------
    
    nn=0;
    for i=1:ny+1
        for j=1:nx+1
            nn=nn+1;
            gcoord(nn,1)=disx*(j-1);
            gcoord(nn,2)=disy*(i-1);
        end
    end
end